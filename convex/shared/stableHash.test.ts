import { describe, expect, test } from "vite-plus/test";
import { fnv1a64Hex, stableStringify } from "./stableHash";

describe("stable hashing", () => {
  test("key order does not change the string", () => {
    expect(stableStringify({ b: 1, a: [3, { d: 1, c: 2 }] })).toBe(
      stableStringify({ a: [3, { c: 2, d: 1 }], b: 1 }),
    );
  });
  test("undefined fields are dropped, null kept", () => {
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
  });
  test("fnv1a64 is deterministic and 16 hex chars", () => {
    expect(fnv1a64Hex("probe")).toMatch(/^[0-9a-f]{16}$/);
    expect(fnv1a64Hex("probe")).toBe(fnv1a64Hex("probe"));
    expect(fnv1a64Hex("probe")).not.toBe(fnv1a64Hex("probf"));
  });
});
