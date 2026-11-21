export type EngineId = "revit" | "navisworks" | "tekla";

export interface EngineConfig {
  id: EngineId;
  label: string;
  /** Base URL of the engine's local bridge (in-process add-in or out-of-process service). */
  baseUrl: string;
  /** Whether the native plugin/add-in for this engine runs inside the host app's own process. */
  inProcess: boolean;
}

function portFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const ENGINES: Record<EngineId, EngineConfig> = {
  revit: {
    id: "revit",
    // Deliberately NOT 8080 (BIM-Bot's default) — so BIM-AZIM's plugin can run side by side with
    // a BIM-Bot install on the same machine without a port collision.
    label: "Autodesk Revit",
    baseUrl: `tcp://127.0.0.1:${portFromEnv("BIMAZIM_REVIT_PORT", 8082)}`,
    inProcess: true,
  },
  navisworks: {
    id: "navisworks",
    label: "Navisworks Manage",
    baseUrl: `tcp://127.0.0.1:${portFromEnv("BIMAZIM_NAVIS_PORT", 8093)}`,
    inProcess: true,
  },
  tekla: {
    id: "tekla",
    label: "Tekla Structures",
    baseUrl: `http://127.0.0.1:${portFromEnv("BIMAZIM_TEKLA_PORT", 8092)}`,
    inProcess: false,
  },
};

export const REQUEST_TIMEOUT_MS = portFromEnv("BIMAZIM_REQUEST_TIMEOUT_MS", 15_000);
