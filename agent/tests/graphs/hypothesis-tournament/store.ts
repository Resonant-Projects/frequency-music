import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  TournamentDependencies,
  TournamentResult,
  TournamentLease,
} from "../../../src/graphs/hypothesis-tournament/types.js";

/** File-backed test database. Synchronous transactions model atomic storage
 * operations in this single test process; this is NOT a production lock. */
export function durableStore(now: () => number = Date.now) {
  const directory = mkdtempSync(join(tmpdir(), "tournament-"));
  const path = join(directory, "store.json");
  type Row = {
    lease: TournamentLease;
    expiresAt: number;
    result?: TournamentResult;
  };
  type State = {
    epoch: number;
    rows: Record<string, Row>;
    snapshots: Parameters<TournamentDependencies["record"]>[0][];
  };
  writeFileSync(path, JSON.stringify({ epoch: 0, rows: {}, snapshots: [] }));
  const read = (): State => JSON.parse(readFileSync(path, "utf8"));
  const write = (state: State) => writeFileSync(path, JSON.stringify(state));
  const fence = (state: State, lease: TournamentLease) => {
    const row = state.rows[lease.runId];
    if (
      !row ||
      row.result ||
      row.lease.token !== lease.token ||
      now() >= row.expiresAt
    )
      throw new Error("Stale lease");
    return row;
  };
  const connect = (): Pick<
    TournamentDependencies,
    "beginRun" | "completeRun" | "record" | "createDraft"
  > => ({
    async beginRun({ runId, leaseDurationMs }) {
      const state = read();
      const row = state.rows[runId];
      if (row?.result) return { status: "replay", result: row.result };
      if (row && now() < row.expiresAt) return { status: "busy" };
      const lease = { runId, token: String(++state.epoch) };
      state.rows[runId] = { lease, expiresAt: now() + leaseDurationMs };
      write(state);
      return { status: "acquired", lease };
    },
    async completeRun({ lease, result }) {
      const state = read();
      fence(state, lease).result = result;
      write(state);
    },
    async record(snapshot) {
      const state = read();
      fence(state, snapshot.lease);
      state.snapshots.push(snapshot);
      write(state);
    },
    async createDraft({ lease, result }) {
      const state = read();
      const row = fence(state, lease);
      const draftId = "draft-1";
      const saved = structuredClone(result);
      saved.draftId = draftId;
      saved.candidates.find((c) => c.outcome === "submitted")!.draftId =
        draftId;
      row.result = saved;
      state.snapshots.push({
        lease,
        stage: "submitted",
        candidates: saved.candidates,
        pairs: saved.pairs,
      });
      write(state);
      return { status: "created", result: saved };
    },
  });
  return {
    connect,
    read,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
    expire: (runId: string) => {
      const state = read();
      delete state.rows[runId];
      write(state);
    },
  };
}
