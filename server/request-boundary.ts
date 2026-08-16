import type { NextFunction, Request, Response } from "express";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function isAllowedLoopbackHost(hostHeader: string | undefined, port: number): boolean {
  if (!hostHeader) return false;
  const normalized = hostHeader.trim().toLowerCase();
  return LOOPBACK_HOSTS.has(normalized)
    || LOOPBACK_HOSTS.has(normalized.replace(new RegExp(`:${port}$`), ""));
}

export function isAllowedLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function enforceLocalRequestBoundary(port: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isAllowedLoopbackHost(req.headers.host, port)) {
      return res.status(403).json({ error: "ShipShell rechazó un Host no local." });
    }
    if (!isAllowedLocalOrigin(req.headers.origin)) {
      return res.status(403).json({ error: "ShipShell rechazó un Origin no local." });
    }
    return next();
  };
}
