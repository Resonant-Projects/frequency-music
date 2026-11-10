// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import { parseScore } from "./rating";

describe("parseScore", () => {
  it("reads a blank field as not given", () => {
    expect(parseScore("")).toBeUndefined();
    expect(parseScore("  ")).toBeUndefined();
  });
  it("accepts whole numbers from 0 to 5", () => {
    expect(parseScore("0")).toBe(0);
    expect(parseScore("3")).toBe(3);
    expect(parseScore("5")).toBe(5);
  });
  it("rejects anything else", () => {
    for (const raw of ["6", "-1", "2.5", "abc"]) {
      expect(parseScore(raw)).toBeNull();
    }
  });
});
