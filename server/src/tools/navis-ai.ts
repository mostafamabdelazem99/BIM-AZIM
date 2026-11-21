import { z } from "zod";
import { defineTool } from "./types.js";

/** Navisworks AI-assist tools, ported from BIM-Bot's navis_ai_tools.ts — needs a Gemini API key
 * configured in the Navisworks plugin before these do anything real (see revit-ai.ts for the
 * same caveat on the Revit side). */
export const navisAiTools = [
  defineTool({
    name: "navis_ai_chat",
    description: "Send a message to Gemini AI for Navisworks coordination help. Maintains conversation context (separate from Revit ai_chat).",
    inputShape: {
      message: z.string().describe("Your message or question for the AI"),
      model: z.enum(["gemini-2.5-flash", "gemini-2.5-pro"]).default("gemini-2.5-flash"),
    },
    bridgeToolName: "navis_ai_chat",
  }),

  defineTool({
    name: "navis_ai_analyze_clashes",
    description: "Fetch clash results from Navisworks then ask Gemini to triage them (group, prioritize, suggest owners).",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      limit: z.number().default(50).describe("Max clashes to fetch for analysis"),
    },
    bridgeToolName: "navis_ai_analyze_clashes",
  }),

  defineTool({
    name: "navis_ai_generate_plugin_code",
    description: "Use AI to generate C# code for the Navisworks API from a natural language description.",
    inputShape: {
      description: z.string().describe("Describe what the code should do in plain English"),
    },
    bridgeToolName: "navis_ai_generate_plugin_code",
  }),
] as const;
