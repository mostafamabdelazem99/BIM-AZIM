import { z } from "zod";
import { defineTool } from "./types.js";

/**
 * Revit AI-assist tools, ported from BIM-Bot's ai_tools.ts. These wrap external AI services
 * (Google Gemini, local Ollama) rather than pure Revit API calls — the Revit plugin's bridge
 * handler for each needs the corresponding credential/local service configured:
 *   - ai_chat / ai_generate / ai_generate_code / ai_analyze_data / ai_analyze_model /
 *     ai_clear_history / ai_element_filter / ai_map_fields / ai_summarize_and_push (gemini path)
 *     need a Gemini API key configured in the plugin.
 *   - ollama_chat / ai_summarize_and_push (ollama path) need Ollama running locally.
 *   - google_sign_in needs Google OAuth configured for AI-assisted field mapping/push features.
 * The tool definitions themselves don't require any of this — only calling them does, same as
 * tekla_push_to_trimble_connect being defined but stubbed until Trimble Connect is wired up.
 */
export const revitAiTools = [
  defineTool({
    name: "revit_ai_chat",
    description: "Send a message to Google Gemini AI for Revit-related help. Maintains conversation context.",
    inputShape: {
      message: z.string().describe("Your message or question for the AI"),
      model: z.enum(["gemini-2.5-flash", "gemini-2.5-pro"]).default("gemini-2.5-flash").describe("AI model"),
    },
    bridgeToolName: "ai_chat",
  }),

  defineTool({
    name: "revit_ollama_chat",
    description: "Chat with a local AI (Ollama / Qwen 2.5 7b) acting as a BIM Data Architect. Maintains conversation history. Ollama must be running locally.",
    inputShape: {
      message: z.string().describe("Your message or question for the local AI"),
      model: z.string().default("qwen2.5:7b-instruct-q4_K_M").describe("Ollama model name"),
    },
    bridgeToolName: "ollama_chat",
  }),

  defineTool({
    name: "revit_ai_generate",
    description: "Generate a single AI response without conversation history. Good for one-off questions.",
    inputShape: {
      prompt: z.string().describe("The prompt to send to Gemini"),
    },
    bridgeToolName: "ai_generate",
  }),

  defineTool({
    name: "revit_ai_generate_code",
    description: "Use AI to generate C# code for the Revit API from a natural language description.",
    inputShape: {
      description: z.string().describe("Describe what the code should do in plain English"),
    },
    bridgeToolName: "ai_generate_code",
  }),

  defineTool({
    name: "revit_ai_analyze_data",
    description: "Use a local AI (Ollama / Qwen 2.5 7b) to analyze Revit element data and provide BIM insights. Analyzes patterns, detects anomalies, suggests optimizations. Ollama must be running locally.",
    inputShape: {
      category: z.string().describe("Revit category to analyze, e.g. 'Doors', 'Rooms', 'Walls'"),
      analysisType: z.enum(["summary", "anomalies", "cost_estimate", "compliance", "optimization"]).default("summary"),
      maxElements: z.number().default(20).describe("Max elements to send to AI (to fit in context window)"),
    },
    bridgeToolName: "ai_analyze_data",
  }),

  defineTool({
    name: "revit_ai_analyze_model",
    description: "Use AI to analyze Revit model data and provide insights, issues, and recommendations.",
    inputShape: {
      modelData: z.record(z.unknown()).describe("Model data to analyze (from get_model_statistics or audit_model)"),
    },
    bridgeToolName: "ai_analyze_model",
  }),

  defineTool({
    name: "revit_ai_clear_history",
    description: "Clear the AI conversation history to start a fresh chat.",
    inputShape: {},
    bridgeToolName: "ai_clear_history",
  }),

  defineTool({
    name: "revit_ai_element_filter",
    description: "Use natural language to filter elements. Describe what you want to find and the system will translate it to Revit filters, e.g. 'all doors wider than 900mm in Level 1'. Returns matching elements with their IDs (use select_elements to highlight them).",
    inputShape: {
      query: z.string().describe("Natural language description of elements to find, e.g. 'all walls taller than 3 m'"),
      category: z.string().optional().describe("Optional category hint to narrow the search"),
    },
    bridgeToolName: "ai_element_filter",
  }),

  defineTool({
    name: "revit_ai_map_fields",
    description: "Use a local AI (Ollama / Qwen 2.5 7b) to intelligently map Revit element fields to target database headers. Ollama must be running locally (ollama serve).",
    inputShape: {
      category: z.string().describe("Revit category to analyze, e.g. 'Doors', 'Rooms'"),
      targetHeaders: z.array(z.string()).describe("Target column headers to map to, e.g. ['Door ID', 'Floor', 'Size', 'Material']"),
    },
    bridgeToolName: "ai_map_fields",
  }),

  defineTool({
    name: "revit_ai_summarize_and_push",
    description: "Ask Ollama (Qwen 2.5 7b) to summarize Revit data (e.g. Room count) and push the result to Google Sheets or Excel. Ollama must be running locally.",
    inputShape: {
      category: z.string().describe("Revit category to summarize, e.g. 'Rooms', 'Doors', 'Walls'"),
      pushTo: z.enum(["excel", "google_sheets"]).default("excel").describe("Where to push the summary"),
      filePath: z.string().optional().describe("Excel file path (optional, defaults to Desktop)"),
      spreadsheetId: z.string().optional().describe("Google Sheets spreadsheet ID (required if pushTo = 'google_sheets')"),
    },
    bridgeToolName: "ai_summarize_and_push",
  }),

  defineTool({
    name: "revit_google_sign_in",
    description: "Sign in with your Google account for AI features. Opens a browser window for authentication.",
    inputShape: {},
    bridgeToolName: "google_sign_in",
  }),
] as const;
