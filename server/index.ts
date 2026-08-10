import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import { decideMission } from "./decision.js";
import { resolveWorkspace, reviewCommand } from "./guard.js";
import { Logbook } from "./logbook.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, "in documents") });

const app = express();
const port = Number(process.env.SHIPSHELL_PORT ?? 8787);
const workspace = resolveWorkspace(root);
const logbook = new Logbook(path.join(root, ".shipshell", "logbook.json"));
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.use(cors({ origin: ["http://127.0.0.1:5173", "http://localhost:5173"] }));
app.use(express.json({ limit: "64kb" }));

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

const missionSchema = z.object({ input: z.string().trim().min(1).max(4000) });
app.post("/api/missions", async (req, res, next) => {
  try {
    const { input } = missionSchema.parse(req.body);
    const decision = decideMission(input);

    if (decision.kind === "navigate") {
      const entry = await logbook.append({
        event: "mission",
        status: "planned",
        summary: `Ruta preparada: ${decision.normalizedInput}`,
        evidence: { decision },
      });
      return res.json({ decision, entry });
    }

    if (!client) {
      return res.status(503).json({ error: "OPENAI_API_KEY no está configurada.", decision });
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
      reasoning: { effort: "low" },
      tools: decision.kind === "search" ? [{ type: "web_search" }] : [],
      input: [
        {
          role: "system",
          content: "Eres la tripulación de BlackMamba ShipShell. Responde en el idioma del usuario. Separa hechos, inferencias y maniobras propuestas. No afirmes haber ejecutado acciones externas. Solicita ShipSeal antes de publicar, comprar, borrar, enviar o modificar cuentas.",
        },
        { role: "user", content: decision.normalizedInput },
      ],
    });

    const entry = await logbook.append({
      event: "mission",
      status: "completed",
      summary: decision.normalizedInput,
      evidence: { responseId: response.id, kind: decision.kind },
    });
    return res.json({ decision, answer: response.output_text, responseId: response.id, entry });
  } catch (error) {
    next(error);
  }
});

const terminalSchema = z.object({ command: z.string().trim().min(1).max(500) });
app.post("/api/terminal/preview", (req, res) => {
  const { command } = terminalSchema.parse(req.body);
  res.json(reviewCommand(command));
});

app.post("/api/terminal/run", async (req, res, next) => {
  try {
    const { command } = terminalSchema.parse(req.body);
    const decision = reviewCommand(command);
    if (!decision.allowed || !decision.executable) {
      await logbook.append({ event: "terminal", status: "blocked", summary: command, evidence: { decision } });
      return res.status(403).json(decision);
    }

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve, reject) => {
      const child = spawn(decision.executable!, decision.args ?? [], {
        cwd: workspace,
        shell: false,
        env: { ...process.env, OPENAI_API_KEY: undefined },
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => child.kill("SIGTERM"), 10_000);
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      child.on("error", reject);
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        resolve({ stdout: stdout.slice(0, 100_000), stderr: stderr.slice(0, 100_000), exitCode });
      });
    });
    await logbook.append({ event: "terminal", status: result.exitCode === 0 ? "completed" : "failed", summary: command, evidence: { exitCode: result.exitCode } });
    res.json({ decision, ...result });
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
