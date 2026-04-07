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
      this.rows.filter((row) => conditions.every(([field, value]) => row[field] === value)),
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

  take(limit: number) {
    return Promise.resolve(this.rows.slice(0, limit));
  }

  first() {
    return Promise.resolve(this.rows[0] ?? null);
  }
}

export function makeDb(tables: Tables) {
  return {
    get(table: TableName, id: string) {
      return Promise.resolve((tables[table] ?? []).find((row) => row._id === id) ?? null);
    },
    query(table: TableName) {
      return new FakeQuery(tables[table] ?? []);
    },
  };
}
