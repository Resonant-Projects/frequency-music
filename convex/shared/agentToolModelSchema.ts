import { z } from "zod";
import { zodToConvex } from "convex-helpers/server/zod4";

/** Convert registered Convex ID validators into their model-facing string type. */
export function agentToolModelJsonSchema(schema: z.ZodObject) {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-7",
    io: "input",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema._zod.def.type !== "custom") return;
      // Use the same Convex Helpers registry as agentToolArgs. Independent
      // package installs may otherwise have different zid registries.
      const validator = zodToConvex(zodSchema);
      if (validator.kind !== "id") {
        throw new Error(
          "Only Convex ID custom schemas are model-representable",
        );
      }
      jsonSchema.type = "string";
    },
  });
  // Zod attaches a non-enumerable Standard Schema adapter to its result.
  // Return plain JSON so LangChain uses this conversion rather than invoking
  // that adapter again without our registered-ID override.
  return { ...jsonSchema };
}
