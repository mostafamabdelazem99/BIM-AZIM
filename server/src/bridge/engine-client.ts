import { EngineConfig, REQUEST_TIMEOUT_MS } from "../config.js";

export interface BridgeResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Talks to one engine's local bridge (Revit/Navisworks in-process add-in, or the
 * out-of-process Tekla bridge service). Every bridge exposes the same contract:
 *   GET  /health             -> { ok: true, data: { connected, version, modelName } }
 *   POST /tools/:name        -> { ok, data?, error? }
 */
export class EngineClient {
  constructor(private readonly engine: EngineConfig) {}

  async health(): Promise<BridgeResult<{ connected: boolean; version?: string; modelName?: string }>> {
    return this.request("GET", "/health");
  }

  async callTool<T = unknown>(toolName: string, args: Record<string, unknown>): Promise<BridgeResult<T>> {
    return this.request("POST", `/tools/${encodeURIComponent(toolName)}`, args);
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<BridgeResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${this.engine.baseUrl}${path}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: `${this.engine.label} bridge returned HTTP ${res.status}: ${text || res.statusText}` };
      }

      return (await res.json()) as BridgeResult<T>;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const hint = this.engine.inProcess
        ? `is ${this.engine.label} running with the BIM-AZIM add-in loaded?`
        : `is the BIM-AZIM Tekla bridge service running alongside ${this.engine.label}?`;
      return { ok: false, error: `Could not reach the ${this.engine.label} bridge at ${this.engine.baseUrl} (${hint}). Detail: ${reason}` };
    } finally {
      clearTimeout(timeout);
    }
  }
}
