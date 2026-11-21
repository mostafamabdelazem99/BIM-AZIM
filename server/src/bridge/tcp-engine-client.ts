import { Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { EngineConfig, REQUEST_TIMEOUT_MS } from "../config.js";
import { BridgeResult } from "./engine-client.js";
import { readHandshake } from "./handshake.js";

/**
 * Talks to the Revit / Navisworks in-process plugins over the wire protocol ported from BIM-Bot:
 * a loopback TCP socket, length-prefixed JSON-RPC 2.0 framing ("Content-Length: N\n{json}"),
 * request shape { jsonrpc, method, params, id, auth }, response matched back by id.
 *
 * Exposes the same public shape as the HTTP-based EngineClient (health/callTool) so index.ts can
 * use either transport interchangeably per engine.
 */
export class TcpEngineClient {
  private socket: Socket | null = null;
  private connecting: Promise<Socket> | null = null;
  private buffer = Buffer.alloc(0);
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private reconnectDelayMs = 500;

  constructor(
    private readonly engine: EngineConfig,
    private readonly handshakeFileName: string,
    private readonly fallbackPort: number,
  ) {}

  async health(): Promise<BridgeResult<{ connected: boolean; version?: string; modelName?: string }>> {
    const result = await this.send("ping", {});
    if (!result.ok) return { ok: true, data: { connected: false } };
    return { ok: true, data: { connected: true, ...((result.data as object) ?? {}) } };
  }

  async callTool<T = unknown>(toolName: string, args: Record<string, unknown>): Promise<BridgeResult<T>> {
    return this.send<T>(toolName, args);
  }

  private async send<T>(method: string, params: Record<string, unknown>): Promise<BridgeResult<T>> {
    let socket: Socket;
    try {
      socket = await this.getSocket();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Could not reach the ${this.engine.label} plugin (is it running with BIM-AZIM loaded?). Detail: ${reason}`,
      };
    }

    const handshake = readHandshake(this.handshakeFileName, this.fallbackPort);
    const id = randomUUID();
    const payload = JSON.stringify({ jsonrpc: "2.0", method, params, id, auth: handshake.token });
    const framed = `Content-Length: ${Buffer.byteLength(payload, "utf8")}\n${payload}`;

    return new Promise<BridgeResult<T>>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: `${this.engine.label} did not respond to '${method}' within ${REQUEST_TIMEOUT_MS}ms.` });
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (value) => resolve({ ok: true, data: value as T }),
        reject: (err) => resolve({ ok: false, error: err.message }),
        timer,
      });

      socket.write(framed, "utf8", (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          resolve({ ok: false, error: `Failed writing to ${this.engine.label}: ${err.message}` });
        }
      });
    });
  }

  private async getSocket(): Promise<Socket> {
    if (this.socket && !this.socket.destroyed) return this.socket;
    if (this.connecting) return this.connecting;

    const handshake = readHandshake(this.handshakeFileName, this.fallbackPort);

    this.connecting = new Promise<Socket>((resolve, reject) => {
      const socket = new Socket();
      const onError = (err: Error) => {
        socket.destroy();
        reject(err);
      };

      socket.once("error", onError);
      socket.connect(handshake.port, handshake.host, () => {
        socket.off("error", onError);
        socket.on("data", (chunk) => this.onData(chunk));
        socket.on("error", () => this.teardown());
        socket.on("close", () => this.teardown());
        this.socket = socket;
        this.reconnectDelayMs = 500;
        resolve(socket);
      });
    }).finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  private teardown() {
    this.socket = null;
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error("Connection closed."));
    }
    this.pending.clear();
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    // "Content-Length: N\n{json}" framing, same as the ported plugin's SocketService.
    for (;;) {
      const text = this.buffer.toString("utf8");
      const headerMatch = /^Content-Length:\s*(\d+)\n/.exec(text);
      let jsonStart: number;
      let length: number;

      if (headerMatch) {
        jsonStart = headerMatch[0].length;
        length = Number.parseInt(headerMatch[1], 10);
      } else {
        // Legacy fallback: raw brace-counted JSON with no length header.
        const braceEnd = findBalancedJsonEnd(text);
        if (braceEnd === -1) return;
        jsonStart = 0;
        length = braceEnd;
      }

      if (this.buffer.length < jsonStart + length) return; // wait for more data

      const jsonText = this.buffer.subarray(jsonStart, jsonStart + length).toString("utf8");
      this.buffer = this.buffer.subarray(jsonStart + length);

      try {
        const message = JSON.parse(jsonText) as { id?: string; result?: unknown; error?: { message?: string } };
        if (!message.id) continue;
        const pending = this.pending.get(message.id);
        if (!pending) continue;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message ?? "Unknown engine error."));
        else pending.resolve(message.result);
      } catch {
        // Malformed frame — drop it and keep the connection alive, matching the plugin's own
        // tolerance for the occasional garbled message.
      }
    }
  }
}

function findBalancedJsonEnd(text: string): number {
  if (text[0] !== "{") return -1;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}
