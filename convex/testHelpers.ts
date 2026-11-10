export type TableName =
  | "campaigns"
  | "theses"
  | "hypotheses"
  | "recipes"
  | "compositions"
  | "listeningSessions"
  | "sources"
  | "extractions"
  | "weeklyBriefs"
  | "editorialArtifacts";

export type Tables = Record<TableName, any[]>;

/** A users row for a test identity; returns its id. */
export async function seedUser(
  t: { run: <T>(fn: (ctx: any) => Promise<T>) => Promise<T> },
  clerkUserId: string,
  role: "admin" | "collaborator" | "follower" = "collaborator",
) {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkUserId,
      role,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

/** Seeds a users row for the identity and returns the client signed in as it. */
export async function asWriter<R>(
  t: {
    run: <T>(fn: (ctx: any) => Promise<T>) => Promise<T>;
    withIdentity: (identity: { subject: string; name?: string }) => R;
  },
  identity: string | { subject: string; name?: string },
  role: "admin" | "collaborator" | "follower" = "collaborator",
): Promise<R> {
  const signedIn =
    typeof identity === "string" ? { subject: identity } : identity;
  await seedUser(t, signedIn.subject, role);
  return t.withIdentity(signedIn);
}

export class FakeQuery<T extends Record<string, any>> {
  constructor(private rows: T[]) {}

  withIndex(_name: string, apply?: (q: any) => any) {
    if (!apply) return this;
    const conditions: Array<[string, unknown]> = [];
    const q = {
      eq: (field: string, value: unknown) => {
        conditions.push([field, value]);
        return q;
      },
    };
    apply(q);
    return new FakeQuery(
      this.rows.filter((row) =>
        conditions.every(([field, value]) => row[field] === value),
      ),
    );
  }

  filter(
    apply: (q: {
      field: (name: string) => string;
      neq: (field: string, value: unknown) => (row: T) => boolean;
    }) => (row: T) => boolean,
  ) {
    return new FakeQuery(
      this.rows.filter(
        apply({
          field: (name) => name,
          neq: (field, value) => (row) => row[field] !== value,
        }),
      ),
    );
  }

  order(direction: "asc" | "desc") {
    const sorted = [...this.rows].toSorted((a, b) =>
      direction === "desc"
        ? (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
        : (a.updatedAt ?? a.createdAt ?? 0) - (b.updatedAt ?? b.createdAt ?? 0),
    );
    return new FakeQuery(sorted);
  }

  collect() {
    return Promise.resolve([...this.rows]);
  }

  async *[Symbol.asyncIterator]() {
    for (const row of this.rows) yield row;
  }

  take(limit: number) {
    return Promise.resolve(this.rows.slice(0, limit));
  }

  first() {
    return Promise.resolve(this.rows[0] ?? null);
  }
}

export function makeDb(tables: Partial<Tables>) {
  return {
    get(table: TableName, id: string) {
      return Promise.resolve(
        (tables[table] ?? []).find((row) => row._id === id) ?? null,
      );
    },
    query(table: TableName) {
      return new FakeQuery(tables[table] ?? []);
    },
  };
}
