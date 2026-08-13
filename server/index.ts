import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import { buildMissionInput, pageContextSchema, SHIPSHELL_COPILOT_SYSTEM_PROMPT } from "./browser-context.js";
import { buildCopilotProfileInstruction, copilotProfileSchema } from "./copilot-profile.js";
import { decideMission } from "./decision.js";
import { resolveTerminalDirectory, resolveWorkspace, reviewCommand } from "./guard.js";
import { Logbook } from "./logbook.js";
import { TerminalSealStore } from "./terminal-seal.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, "in documents") });

const app = express();
const port = Number(process.env.SHIPSHELL_PORT ?? 8787);
const workspace = resolveWorkspace(root);
const logbook = new Logbook(path.join(root, ".shipshell", "logbook.json"));
const terminalSeals = new TerminalSealStore();
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
let terminalCwd = workspace;

app.use(cors({ origin: ["http://127.0.0.1:5173", "http://localhost:5173"] }));
app.use(express.json({ limit: "64kb" }));

function displayCwd() {
  const relative = path.relative(workspace, terminalCwd);
  return relative ? `./${relative}` : ".";
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    system: "BlackMamba ShipShell",
    model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
    aiConfigured: Boolean(client),
    workspace,
  });
});

app.get("/api/logbook", async (_req, res, next) => {
  try {
    res.json({ entries: await logbook.list() });
  } catch (error) {
    next(error);
  }
});

const missionSchema = z.object({
  input: z.string().trim().min(1).max(4000),
  context: pageContextSchema.optional(),
  profile: copilotProfileSchema.optional(),
});

app.post("/api/missions", async (req, res, next) => {
  try {
    const { input, context, profile } = missionSchema.parse(req.body);
    const decision = decideMission(input);

    if (decision.kind === "navigate") {
      const entry = await logbook.append({
        event: "mission",
        status: "planned",
        summary: `Ruta preparada: ${decision.normalizedInput}`,
        evidence: { decision, universeId: profile?.universeId },
      });
      return res.json({ decision, entry });
    }

    if (!client) {
      return res.status(503).json({ error: "OPENAI_API_KEY no está configurada.", decision });
    }

    const profileInstruction = buildCopilotProfileInstruction(profile);
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
      reasoning: { effort: "low" },
      tools: decision.kind === "search" ? [{ type: "web_search" }] : [],
      input: [
        { role: "system", content: [SHIPSHELL_COPILOT_SYSTEM_PROMPT, profileInstruction].filter(Boolean).join("\n\n") },
        { role: "user", content: buildMissionInput(decision.normalizedInput, context) },
      ],
    });

    const entry = await logbook.append({
      event: "mission",
      status: "completed",
      summary: decision.normalizedInput,
      evidence: {
        responseId: response.id,
        kind: decision.kind,
        contextUsed: Boolean(context?.available),
        contextUrl: context?.available ? context.url : undefined,
        universeId: profile?.universeId,
        workMode: profile?.workMode,
        voice: profile?.voice,
      },
    });
    return res.json({ decision, answer: response.output_text, responseId: response.id, entry });
  } catch (error) {
    next(error);
  }
});

const terminalCommandSchema = z.object({
  command: z.string().trim().min(1).max(1000),
  sealId: z.string().uuid().optional(),
});
const terminalApprovalSchema = z.object({
  id: z.string().uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

app.get("/api/terminal/state", (_req, res) => {
  res.json({ cwd: displayCwd() });
});

app.post("/api/terminal/preview", (req, res) => {
  const { command } = terminalCommandSchema.pick({ command: true }).parse(req.body);
  const decision = reviewCommand(command);
  const approval = decision.allowed && decision.requiresSeal
    ? terminalSeals.issue(command, terminalCwd, decision)
    : undefined;
  res.json({ decision, cwd: displayCwd(), approval });
});

app.post("/api/terminal/approve", (req, res) => {
  const { id, fingerprint } = terminalApprovalSchema.parse(req.body);
  if (!terminalSeals.approve(id, fingerprint)) {
    return res.status(403).json({ error: "ShipSeal inválido, vencido o ya consumido." });
  }
  return res.json({ ok: true });
});

app.post("/api/terminal/run-stream", async (req, res, next) => {
  try {
    const { command, sealId } = terminalCommandSchema.parse(req.body);
    const decision = reviewCommand(command);
    if (!decision.allowed) {
      await logbook.append({ event: "terminal", status: "blocked", summary: command, evidence: { decision, cwd: displayCwd() } });
      return res.status(403).json({ error: decision.reason, decision });
    }
    if (!terminalSeals.consume(sealId, command, terminalCwd, decision)) {
      await logbook.append({ event: "terminal", status: "blocked", summary: command, evidence: { decision, cwd: displayCwd(), reason: "seal-required" } });
      return res.status(403).json({ error: "Esta maniobra requiere un ShipSeal aprobado y de un solo uso.", decision });
    }

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const emit = (payload: unknown) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(payload)}\n`);
    };

    emit({ type: "start", cwd: displayCwd(), decision });

    if (decision.builtin === "clear") {
      emit({ type: "clear" });
      emit({ type: "exit", exitCode: 0, cwd: displayCwd() });
      res.end();
      await logbook.append({ event: "terminal", status: "completed", summary: command, evidence: { builtin: "clear", cwd: displayCwd() } });
      return;
    }

    if (decision.builtin === "cd") {
      const next = resolveTerminalDirectory(workspace, terminalCwd, decision.args?.[0] ?? ".");
      if (!next) {
        emit({ type: "stderr", data: "ShipSeal: no puedes salir del workspace.\n" });
        emit({ type: "exit", exitCode: 1, cwd: displayCwd() });
        res.end();
        return;
      }
      try {
        if (!statSync(next).isDirectory()) throw new Error("not-directory");
      } catch {
        emit({ type: "stderr", data: `cd: no existe un directorio válido: ${decision.args?.[0] ?? "."}\n` });
        emit({ type: "exit", exitCode: 1, cwd: displayCwd() });
        res.end();
        return;
      }
      terminalCwd = next;
      emit({ type: "cwd", cwd: displayCwd() });
      emit({ type: "exit", exitCode: 0, cwd: displayCwd() });
      res.end();
      await logbook.append({ event: "terminal", status: "completed", summary: command, evidence: { builtin: "cd", cwd: displayCwd() } });
      return;
    }

    if (!decision.executable) {
      emit({ type: "stderr", data: "No hay ejecutable asociado a esta maniobra.\n" });
      emit({ type: "exit", exitCode: 1, cwd: displayCwd() });
      res.end();
      return;
    }

    const child = spawn(decision.executable, decision.args ?? [], {
      cwd: terminalCwd,
      shell: false,
      env: {
        ...process.env,
        OPENAI_API_KEY: undefined,
        NPM_TOKEN: undefined,
        GITHUB_TOKEN: undefined,
        GH_TOKEN: undefined,
      },
    });

    let outputBytes = 0;
    let settled = false;
    const maxOutputBytes = 1_000_000;
    const timer = setTimeout(() => child.kill("SIGTERM"), 5 * 60_000);
    const pushChunk = (type: "stdout" | "stderr", chunk: Buffer) => {
      if (settled) return;
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        emit({ type: "stderr", data: "\n[ShipShell] salida detenida al superar 1 MB.\n" });
        child.kill("SIGTERM");
        return;
      }
      emit({ type, data: chunk.toString() });
    };

    child.stdout.on("data", (chunk: Buffer) => pushChunk("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => pushChunk("stderr", chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      emit({ type: "error", message: error.message });
      emit({ type: "exit", exitCode: 1, cwd: displayCwd() });
      res.end();
    });
    child.on("close", async (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      emit({ type: "exit", exitCode, cwd: displayCwd() });
      res.end();
      await logbook.append({
        event: "terminal",
        status: exitCode === 0 ? "completed" : "failed",
        summary: command,
        evidence: { exitCode, risk: decision.risk, sealed: decision.requiresSeal, cwd: displayCwd() },
      });
    });
    req.on("close", () => {
      if (!settled && !child.killed) child.kill("SIGTERM");
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Solicitud inválida", details: error.issues });
  res.status(500).json({ error: error instanceof Error ? error.message : "Error interno" });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`ShipShell API ready on http://127.0.0.1:${port}`);
});
