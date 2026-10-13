import {
  discordId,
  object,
  telegramId,
} from "../../convex/decisionSignerParsing";

/**
 * Wave 2 rollout helpers. Pure functions with injected transports: they never
 * read `.env` files, resolve credentials, or return configuration values.
 */

export const SIGNER_PLATFORMS = ["discord", "telegram"] as const;
export type SignerPlatform = (typeof SIGNER_PLATFORMS)[number];

const PLATFORM_SETTINGS: Record<SignerPlatform, readonly string[]> = {
  discord: [
    "DECISION_DISCORD_BOT_TOKEN",
    "DECISION_DISCORD_CHANNEL_ID",
    "DECISION_DISCORD_APPLICATION_ID",
    "DECISION_DISCORD_PUBLIC_KEY",
  ],
  telegram: [
    "DECISION_TELEGRAM_BOT_TOKEN",
    "DECISION_TELEGRAM_CHAT_ID",
    "DECISION_TELEGRAM_PATH_SECRET",
    "DECISION_TELEGRAM_HEADER_SECRET",
  ],
};
const SECRET_SEGMENT = /^[A-Za-z0-9_-]{1,256}$/;

/** Format rules from `convex/decisionSignerRuntime.ts` `configuration()`. */
function settingValid(name: string, value: string): boolean {
  switch (name) {
    case "DECISION_DISCORD_CHANNEL_ID":
    case "DECISION_DISCORD_APPLICATION_ID":
      return discordId(value) !== null;
    case "DECISION_DISCORD_PUBLIC_KEY":
      return /^[a-fA-F0-9]{64}$/.test(value);
    case "DECISION_TELEGRAM_BOT_TOKEN":
      return /^[0-9]+:[A-Za-z0-9_-]+$/.test(value);
    case "DECISION_TELEGRAM_CHAT_ID":
      return telegramId(Number(value), true) === value;
    case "DECISION_TELEGRAM_PATH_SECRET":
    case "DECISION_TELEGRAM_HEADER_SECRET":
      return SECRET_SEGMENT.test(value);
    default:
      return value.length > 0;
  }
}

export interface PlatformReadiness {
  /** Matches the runtime: activation, a mapping entry and every valid setting. */
  ready: boolean;
  mappedSigners: number;
  missing: string[];
  invalid: string[];
}
export interface SignerReadiness {
  signersEnabled: boolean;
  docketPreparationEnabled: boolean;
  mapping: {
    parsed: boolean;
    /** Keys outside `discord:`/`telegram:` or values that are not nonempty strings. */
    ignoredEntries: number;
  };
  platforms: Record<SignerPlatform, PlatformReadiness>;
}

/** Names, booleans and counts only; no configuration value is copied out. */
export function assessSignerConfiguration(
  env: Readonly<Record<string, string | undefined>>,
): SignerReadiness {
  const signersEnabled = env.DECISION_SIGNERS_ENABLED === "true";
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(env.DECISION_SIGNERS ?? "{}");
  } catch {
    parsed = null;
  }
  const mapping = object(parsed);
  const entries = mapping ? Object.entries(mapping) : [];
  const counted = (platform: SignerPlatform) =>
    entries.filter(
      ([key, value]) =>
        key.startsWith(`${platform}:`) &&
        typeof value === "string" &&
        value.length > 0,
    ).length;
  const platforms = Object.fromEntries(
    SIGNER_PLATFORMS.map((platform) => {
      const missing: string[] = [];
      const invalid: string[] = [];
      for (const name of PLATFORM_SETTINGS[platform]) {
        const value = env[name];
        if (!value) missing.push(name);
        else if (!settingValid(name, value)) invalid.push(name);
      }
      const mappedSigners = counted(platform);
      if (mappedSigners === 0) missing.push("DECISION_SIGNERS");
      return [
        platform,
        {
          ready: signersEnabled && missing.length === 0 && invalid.length === 0,
          mappedSigners,
          missing,
          invalid,
        },
      ];
    }),
  ) as Record<SignerPlatform, PlatformReadiness>;
  return {
    signersEnabled,
    docketPreparationEnabled: env.DOCKET_PREPARATION_ENABLED === "true",
    mapping: {
      parsed: mapping !== null,
      ignoredEntries: entries.length - counted("discord") - counted("telegram"),
    },
    platforms,
  };
}

// --- Revision backfill -----------------------------------------------------

export const BACKFILL_TABLES = ["feeds", "agentReviewDrafts"] as const;
export type BackfillTable = (typeof BACKFILL_TABLES)[number];
export const BACKFILL_FUNCTION = "decisionIntentsMigrations:backfillRevisions";
export const DEFAULT_BACKFILL_BATCH = 50;
export const MAX_BACKFILL_PAGES = 10_000;

export interface BackfillPass {
  cursor: string | null;
  done: boolean;
  pages: number;
  updated: number;
  /**
   * Set before each call and cleared once its result is checkpointed. A pending
   * verification page on resume may have committed updates whose count was
   * lost, so the verification pass restarts from the beginning.
   */
  pending: boolean;
}
export interface BackfillTableState {
  backfill: BackfillPass;
  /** A full repeat pass; acceptance requires it to finish with zero updates. */
  verify: BackfillPass;
}
export interface BackfillState {
  version: 1;
  target: string;
  batchSize: number;
  tables: Record<BackfillTable, BackfillTableState>;
}
export type BackfillCall = (args: {
  table: BackfillTable;
  cursor: string | null;
  batchSize: number;
}) => Promise<unknown>;

export const freshPass = (): BackfillPass => ({
  cursor: null,
  done: false,
  pages: 0,
  updated: 0,
  pending: false,
});

export function initialBackfillState(
  target: string,
  batchSize = DEFAULT_BACKFILL_BATCH,
): BackfillState {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100)
    throw new Error("Batch size must be an integer from 1 to 100");
  return {
    version: 1,
    target,
    batchSize,
    tables: {
      feeds: { backfill: freshPass(), verify: freshPass() },
      agentReviewDrafts: { backfill: freshPass(), verify: freshPass() },
    },
  };
}

function isPass(value: unknown): value is BackfillPass {
  const pass = object(value);
  return (
    pass !== null &&
    (pass.cursor === null || typeof pass.cursor === "string") &&
    typeof pass.done === "boolean" &&
    typeof pass.pending === "boolean" &&
    Number.isSafeInteger(pass.pages) &&
    (pass.pages as number) >= 0 &&
    Number.isSafeInteger(pass.updated) &&
    (pass.updated as number) >= 0
  );
}

/** Rejects a state file for another target or with a corrupted shape. */
export function parseBackfillState(
  value: unknown,
  target: string,
): BackfillState {
  const state = object(value);
  const tables = object(state?.tables);
  if (
    !state ||
    state.version !== 1 ||
    state.target !== target ||
    !Number.isInteger(state.batchSize) ||
    (state.batchSize as number) < 1 ||
    (state.batchSize as number) > 100 ||
    !tables ||
    Object.keys(tables).length !== BACKFILL_TABLES.length ||
    !BACKFILL_TABLES.every((table) => {
      const entry = object(tables[table]);
      return entry && isPass(entry.backfill) && isPass(entry.verify);
    })
  )
    throw new Error("Backfill state does not match this target or format");
  return value as BackfillState;
}

export type BackfillStep = {
  table: BackfillTable;
  phase: "backfill" | "verify";
  cursor: string | null;
} | null;

/** Backfill each table, then repeat it from the start as a verification pass. */
export function nextBackfillStep(state: BackfillState): BackfillStep {
  for (const table of BACKFILL_TABLES) {
    const entry = state.tables[table];
    if (!entry.backfill.done)
      return { table, phase: "backfill", cursor: entry.backfill.cursor };
    if (!entry.verify.done)
      return {
        table,
        phase: "verify",
        cursor: entry.verify.pending ? null : entry.verify.cursor,
      };
  }
  return null;
}

export function backfillOutcome(state: BackfillState) {
  const tables = Object.fromEntries(
    BACKFILL_TABLES.map((table) => {
      const { backfill, verify } = state.tables[table];
      return [
        table,
        {
          backfilled: backfill.updated,
          backfillPages: backfill.pages,
          verifyPages: verify.pages,
          verifyUpdated: verify.updated,
          verified: backfill.done && verify.done && verify.updated === 0,
        },
      ];
    }),
  ) as Record<
    BackfillTable,
    {
      backfilled: number;
      backfillPages: number;
      verifyPages: number;
      verifyUpdated: number;
      verified: boolean;
    }
  >;
  const complete = nextBackfillStep(state) === null;
  return {
    complete,
    verified: BACKFILL_TABLES.every((table) => tables[table].verified),
    tables,
  };
}

function parsePage(value: unknown, batchSize: number) {
  const page = object(value);
  if (
    !page ||
    typeof page.cursor !== "string" ||
    typeof page.done !== "boolean" ||
    !Number.isSafeInteger(page.updated) ||
    (page.updated as number) < 0 ||
    (page.updated as number) > batchSize
  )
    throw new Error("Invalid backfill page");
  return page as { cursor: string; done: boolean; updated: number };
}

/**
 * Drives the existing bounded internal mutation one page at a time. The state is
 * checkpointed after every page, so an interrupted run resumes from the last
 * committed cursor. A page that commits before a lost response is harmless:
 * the mutation only initializes absent revisions.
 */
export async function runRevisionBackfill(options: {
  state: BackfillState;
  call: BackfillCall;
  checkpoint: (state: BackfillState) => Promise<void> | void;
  maxPages?: number;
}): Promise<BackfillState> {
  const maxPages = options.maxPages ?? MAX_BACKFILL_PAGES;
  if (!Number.isInteger(maxPages) || maxPages < 1)
    throw new Error("maxPages must be a positive integer");
  const state = structuredClone(options.state);
  for (let calls = 0; calls < maxPages; calls++) {
    const step = nextBackfillStep(state);
    if (!step) return state;
    const pass = state.tables[step.table][step.phase];
    if (step.phase === "verify" && pass.pending)
      Object.assign(pass, freshPass());
    pass.pending = true;
    await options.checkpoint(state);
    const page = parsePage(
      await options.call({
        table: step.table,
        cursor: step.cursor,
        batchSize: state.batchSize,
      }),
      state.batchSize,
    );
    if (!page.done && page.cursor === step.cursor)
      throw new Error("Backfill cursor did not advance");
    pass.cursor = page.cursor;
    pass.done = page.done;
    pass.pages++;
    pass.updated += page.updated;
    pass.pending = false;
    await options.checkpoint(state);
  }
  return state;
}

/** Exact dry-run description; contacts nothing. */
export function describeBackfillPlan(state: BackfillState) {
  const next = nextBackfillStep(state);
  return {
    mode: "dry-run",
    target: state.target,
    function: BACKFILL_FUNCTION,
    visibility: "internal mutation; requires the self-hosted admin key",
    batchSize: state.batchSize,
    order: BACKFILL_TABLES.flatMap((table) => [
      `${table}: backfill until done`,
      `${table}: verification pass from the start; must report zero updates`,
    ]),
    effects: [
      "Patches only rows whose `revision` is absent, setting it to 0.",
      "Never changes an existing revision; repeated runs are idempotent.",
      "Each page is one bounded transaction of at most `batchSize` rows.",
    ],
    nextStep: next
      ? {
          function: BACKFILL_FUNCTION,
          args: {
            table: next.table,
            cursor: next.cursor,
            batchSize: state.batchSize,
          },
          phase: next.phase,
        }
      : null,
    outcome: backfillOutcome(state),
  };
}
