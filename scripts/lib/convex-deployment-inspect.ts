import { createHash } from "node:crypto";
import { z } from "zod";
import { validateOpsOrigin } from "./frequency-queue-evidence";

const label = z.string().max(1024);
const componentsSchema = z
  .array(
    z.object({
      id: label,
      name: label.optional(),
      path: label,
      state: label,
      httpPrefix: label.nullable(),
      args: z.record(z.string(), z.unknown()),
    }),
  )
  .max(100);
// Decode only selected schedule integers; ignored udfArgs bytes never decoded.
function scheduleInteger(minimum: number, maximum: number) {
  return z
    .object({ $integer: z.string().regex(/^[A-Za-z0-9+/]{11}=$/) })
    .transform((value, ctx) => {
      const bytes = Buffer.from(value.$integer, "base64");
      const integer = bytes.readBigInt64LE();
      if (integer < BigInt(minimum) || integer > BigInt(maximum)) {
        ctx.addIssue({
          code: "custom",
          message: "Schedule integer outside bounds",
        });
        return z.NEVER;
      }
      return Number(integer);
    });
}
const minuteUTC = scheduleInteger(0, 59).optional();
const hourUTC = scheduleInteger(0, 23);
const cronSchedule = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("interval"),
    seconds: scheduleInteger(0, Number.MAX_SAFE_INTEGER),
  }),
  z.object({ type: z.literal("hourly"), minuteUTC }),
  z.object({ type: z.literal("daily"), hourUTC, minuteUTC }),
  z.object({
    type: z.literal("weekly"),
    dayOfWeek: scheduleInteger(0, 6),
    hourUTC,
    minuteUTC,
  }),
  z.object({
    type: z.literal("monthly"),
    day: scheduleInteger(1, 31),
    hourUTC,
    minuteUTC,
  }),
  // Numeric five-field expressions only; unsupported syntax fails closed.
  z.object({
    type: z.literal("cron"),
    cronExpr: z
      .string()
      .max(256)
      .regex(/^[0-9*,/-]+(?:[ \t]+[0-9*,/-]+){4}$/),
  }),
]);
const cronSpec = z.object({ udfPath: label, cronSchedule });
const modulesSchema = z
  .array(
    z.tuple([
      label.nullable(),
      z
        .array(
          z.tuple([
            label,
            z.object({
              functions: z
                .array(
                  z.object({
                    name: label,
                    udfType: z.enum([
                      "Query",
                      "Mutation",
                      "Action",
                      "HttpAction",
                    ]),
                    visibility: z.object({
                      kind: z.enum(["public", "internal"]),
                    }),
                  }),
                )
                .max(10_000),
              cronSpecs: z
                .array(z.tuple([label, cronSpec]))
                .max(1000)
                .optional(),
            }),
          ]),
        )
        .max(10_000),
    ]),
  )
  .max(101);
const schemasSchema = z.object({
  active: z.string().optional(),
  inProgress: z.string().optional(),
});

/** Equality fingerprint only, not a confidentiality boundary for guessable values. */
export function metadataHash(value: unknown): string {
  function canonical(item: unknown, depth: number): string {
    if (depth > 64) throw new Error("Invalid metadata");
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean" ||
      typeof item === "number"
    )
      return JSON.stringify(item);
    if (Array.isArray(item))
      return `[${item.map((child) => canonical(child, depth + 1)).join(",")}]`;
    if (typeof item === "object")
      return `{${Object.entries(item)
        .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(
          ([key, child]) =>
            `${JSON.stringify(key)}:${canonical(child, depth + 1)}`,
        )
        .join(",")}}`;
    throw new Error("Invalid metadata");
  }
  return createHash("sha256").update(canonical(value, 0)).digest("hex");
}

/** Existing private system metadata only. Never reads user/job tables. */
export async function inspectDeployment(
  origin: string,
  adminKey: string,
  transport: typeof fetch = fetch,
) {
  const target = validateOpsOrigin(origin);
  if (!adminKey) throw new Error("Existing admin authentication required");
  const signal = AbortSignal.timeout(20_000);
  let totalBytes = 0;
  const startedAt = new Date().toISOString();
  async function query(
    path: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    if (signal.aborted) throw new Error("Metadata deadline exceeded");
    const response = await transport(`${target}/api/query`, {
      method: "POST",
      redirect: "error",
      signal,
      headers: {
        Authorization: `Convex ${adminKey}`,
        "Content-Type": "application/json",
        "Convex-Client": "npm-1.34.1",
      },
      body: JSON.stringify({
        path,
        format: "convex_encoded_json",
        args: [args],
      }),
    });
    if (!response.ok || !response.body)
      throw new Error("Metadata request rejected");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        totalBytes += next.value.byteLength;
        if (
          bytes > 4 * 1024 * 1024 ||
          totalBytes > 16 * 1024 * 1024 ||
          signal.aborted
        )
          throw new Error("Metadata limit exceeded");
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel();
    }
    return z
      .object({ status: z.literal("success"), value: z.unknown() })
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))).value;
  }
  const components = componentsSchema.parse(
    await query("_system/frontend/components:list"),
  );
  const modules = modulesSchema.parse(
    await query("_system/frontend/modules:listForAllComponents"),
  );
  const ids = new Set(components.map((component) => component.id));
  if (ids.size !== components.length) throw new Error("Duplicate components");
  const componentIds = [
    null,
    ...components
      .filter((component) => component.path !== "")
      .map((component) => component.id),
  ];
  if (
    new Set(modules.map(([id]) => id)).size !== modules.length ||
    modules.length !== componentIds.length ||
    modules.some(([id]) => !componentIds.includes(id))
  )
    throw new Error("Incomplete module inventory");
  if (
    new Set(components.map((component) => component.path)).size !==
    components.length
  )
    throw new Error("Duplicate component paths");
  for (const [, entries] of modules) {
    if (new Set(entries.map(([path]) => path)).size !== entries.length)
      throw new Error("Duplicate module paths");
  }
  for (const [, entries] of modules) {
    for (const [, module] of entries) {
      if (
        new Set(module.functions.map((fn) => fn.name)).size !==
        module.functions.length
      )
        throw new Error("Duplicate function names");
      const crons = module.cronSpecs ?? [];
      if (
        new Set(crons.map(([identifier]) => identifier)).size !== crons.length
      )
        throw new Error("Duplicate cron identifiers");
    }
  }
  const schemas = [];
  for (const componentId of componentIds) {
    const schema = schemasSchema.parse(
      await query("_system/frontend/getSchemas", { componentId }),
    );
    schemas.push({
      componentId,
      activeHash:
        schema.active === undefined
          ? null
          : metadataHash(JSON.parse(schema.active)),
      inProgressHash:
        schema.inProgress === undefined
          ? null
          : metadataHash(JSON.parse(schema.inProgress)),
    });
  }
  if (signal.aborted) throw new Error("Metadata deadline exceeded");
  return {
    format: "frequency-deployment-inspection-v1",
    startedAt,
    finishedAt: new Date().toISOString(),
    consistency: "separate-query-snapshots-not-atomic",
    deploymentAuthorized: false,
    functionValidatorsIncluded: false,
    cronSpecsIncluded: false,
    cronSchedulesAndTargetsIncluded: true,
    componentArgumentsIncluded: false,
    schemaStructuralDeltaIncluded: false,
    components: components.map(({ args, ...component }) => ({
      ...component,
      argsCount: Object.keys(args).length,
      argsOmitted: true,
    })),
    modules: modules.map(([componentId, entries]) => ({
      componentId,
      modules: entries.map(([path, module]) => ({
        path,
        functions: module.functions,
        crons: (module.cronSpecs ?? []).map(([identifier, spec]) => ({
          identifier,
          udfPath: spec.udfPath,
          schedule: spec.cronSchedule,
          argsOmitted: true,
        })),
      })),
    })),
    schemas,
  };
}
