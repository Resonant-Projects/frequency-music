// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import { sameQueryArgs } from "./query-args";

describe("sameQueryArgs", () => {
  it("accepts the same reference", () => {
    const args = { id: "a", limit: 5 };
    expect(sameQueryArgs(args, args)).toBe(true);
  });
  it("accepts two separately built equal objects", () => {
    expect(sameQueryArgs({ id: "a", limit: 5 }, { id: "a", limit: 5 })).toBe(
      true,
    );
  });
  it("ignores key order", () => {
    expect(sameQueryArgs({ id: "a", limit: 5 }, { limit: 5, id: "a" })).toBe(
      true,
    );
  });
  it("rejects different values", () => {
    expect(sameQueryArgs({ id: "a" }, { id: "b" })).toBe(false);
  });
  it("compares the skip sentinel", () => {
    expect(sameQueryArgs("skip", "skip")).toBe(true);
    expect(sameQueryArgs("skip", {})).toBe(false);
  });
  it("treats unserializable arguments as different without throwing", () => {
    expect(() => sameQueryArgs({ n: 1n }, { n: 1n })).not.toThrow();
    expect(sameQueryArgs({ n: 1n }, { n: 1n })).toBe(false);
  });
});
