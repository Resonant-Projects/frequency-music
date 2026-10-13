import { AGENT_TOOL_MANIFEST } from "../../../convex/shared/agentToolManifest";
import {
  assertBoundedProposal,
  docketListResultZ,
  docketCardResultZ,
  proposalResultZ,
  deliveryRecordResultZ,
} from "../../../convex/shared/docketTools";
import { z } from "zod";
import { agentToolModelJsonSchema } from "../../../convex/shared/agentToolModelSchema";
import type { AgentToolManifestEntry } from "../../../convex/shared/agentToolManifest";
import { callConvex } from "../tools/convexTools";

export const wave2Tools = [
  "docket.list",
  "docket.card",
  "decision.propose",
  "listening.propose",
  "delivery.record",
] as const;
export type Wave2Tool = (typeof wave2Tools)[number];

/** Trusted integration code supplies canonical shared schemas, never model input. */
export interface BackendOperation {
  args: z.ZodObject;
  result: z.ZodType;
  invoke(args: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
}
export type BackendOperations = Partial<Record<Wave2Tool, BackendOperation>>;

/** Reuse the manifest and existing JSON-body secret transport. No route guessing. */
export function manifestOperation(
  definition: AgentToolManifestEntry,
  result: z.ZodType,
): BackendOperation {
  // The SDK cannot advertise Convex Helpers' custom zid validators. Derive
  // a JSON-compatible Zod schema through the existing registered-ID converter;
  // invoke still validates against the canonical schema before any HTTP call.
  const args = z.fromJSONSchema(agentToolModelJsonSchema(definition.args));
  if (!(args instanceof z.ZodObject))
    throw new Error("Tool input must be an object");
  return {
    args: args.strict(),
    result,
    invoke: (args, signal) => {
      assertBoundedProposal(args);
      return callConvex(definition.name, definition.args.parse(args), signal);
    },
  };
}

export function createWave2Operations(): Record<Wave2Tool, BackendOperation> {
  const operation = (
    name: AgentToolManifestEntry["name"],
    result: z.ZodType,
  ) => {
    const definition = AGENT_TOOL_MANIFEST.find((entry) => entry.name === name);
    if (!definition) throw new Error(`Missing tool registration: ${name}`);
    return manifestOperation(definition, result);
  };
  return {
    "docket.list": operation("listDocket", docketListResultZ),
    "docket.card": operation("getDocketCard", docketCardResultZ),
    "decision.propose": operation("proposeDecision", proposalResultZ),
    "listening.propose": operation("proposeListening", proposalResultZ),
    "delivery.record": operation("recordDocketDelivery", deliveryRecordResultZ),
  };
}
