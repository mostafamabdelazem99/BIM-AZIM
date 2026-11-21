import { z, ZodRawShape } from "zod";
import { EngineClient } from "../bridge/engine-client.js";

export interface ToolDefinition<Shape extends ZodRawShape = ZodRawShape> {
  /** MCP-facing name, e.g. "tekla_get_selected_objects". */
  name: string;
  description: string;
  inputShape: Shape;
  /** Tool name as the native bridge (Revit/Navisworks add-in, Tekla bridge) knows it. */
  bridgeToolName: string;
}

export function defineTool<Shape extends ZodRawShape>(def: ToolDefinition<Shape>): ToolDefinition<Shape> {
  return def;
}

export function emptyInput() {
  return {} as const;
}

/** Shared MCP content-array response shape, used so every engine's tools reply consistently. */
export function toToolResponse(result: { ok: boolean; data?: unknown; error?: string }) {
  if (!result.ok) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: result.error ?? "Unknown bridge error." }],
    };
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result.data ?? {}, null, 2) }],
  };
}

export type ToolHandlerArgs<Shape extends ZodRawShape> = { [K in keyof Shape]: z.infer<Shape[K]> };

export function makeBridgeHandler<Shape extends ZodRawShape>(client: EngineClient, def: ToolDefinition<Shape>) {
  return async (args: ToolHandlerArgs<Shape>) => {
    const result = await client.callTool(def.bridgeToolName, args as Record<string, unknown>);
    return toToolResponse(result);
  };
}
