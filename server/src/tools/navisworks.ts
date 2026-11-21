import { z } from "zod";
import { defineTool } from "./types.js";

/**
 * Navisworks Manage tool catalog — parity scaffold. Forwards to an in-process Navisworks add-in
 * (plugins/Navisworks) exposing the same /tools/:name HTTP contract as the other engines.
 */
export const navisworksTools = [
  defineTool({
    name: "navis_get_model_info",
    description: "Get info about the currently open Navisworks document, including appended/federated files.",
    inputShape: {},
    bridgeToolName: "get_model_info",
  }),

  defineTool({
    name: "navis_get_selected",
    description: "Get the items currently selected in Navisworks with their properties.",
    inputShape: {},
    bridgeToolName: "get_selected",
  }),

  defineTool({
    name: "navis_run_clash_test",
    description: "Run (or re-run) a named Clash Detective test and return a summary of results.",
    inputShape: {
      testName: z.string(),
    },
    bridgeToolName: "run_clash_test",
  }),
] as const;
