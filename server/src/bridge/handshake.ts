import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * The Revit/Navisworks plugins (in-process TCP services, ported from BIM-Bot) write a small
 * handshake file on startup so the MCP server can find them even if their default port was busy
 * and they had to scan to another one. Same shape for both engines, different file name.
 */
export interface Handshake {
  host: string;
  port: number;
  pid?: number;
  token?: string;
}

const LOCALAPPDATA = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
const BIMAZIM_DATA_DIR = join(LOCALAPPDATA, "BimAzim");

export function readHandshake(fileName: string, fallbackPort: number): Handshake {
  const path = join(BIMAZIM_DATA_DIR, fileName);
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<Handshake>;
    return {
      host: parsed.host ?? "127.0.0.1",
      port: typeof parsed.port === "number" ? parsed.port : fallbackPort,
      pid: parsed.pid,
      token: parsed.token,
    };
  } catch {
    // Plugin hasn't started yet, or is on an older build without a handshake file — fall back to
    // the documented default port with no auth token; the engine itself will reject us cleanly if
    // it actually requires one.
    return { host: "127.0.0.1", port: fallbackPort };
  }
}
