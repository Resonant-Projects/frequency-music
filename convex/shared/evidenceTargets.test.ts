/* eslint-disable no-underscore-dangle -- fixtures mirror Convex `_id` rows. */
import { describe, expect, test } from "vite-plus/test";
import {
  lastEvidenceAt,
  orderEvidenceTargets,
  rotateWindow,
} from "./evidenceTargets";

const row = (_id: string, createdAt: number, addedAts: number[] = []) => ({
  _id,
  createdAt,
  evidence: addedAts.map((addedAt) => ({ addedAt })),
});
const ids = (rows: readonly { _id: string }[]) => rows.map((r) => r._id);

describe("evidence target ordering", () => {
  test("lastEvidenceAt is undefined without evidence, else the latest addedAt", () => {
    expect(lastEvidenceAt(row("a", 1))).toBeUndefined();
    expect(lastEvidenceAt(row("a", 1, [30, 70, 50]))).toBe(70);
  });

  test("a Correspondence without evidence comes before one with evidence", () => {
    const ordered = orderEvidenceTargets([row("with", 1, [5]), row("none", 9)]);
    expect(ids(ordered)).toEqual(["none", "with"]);
  });

  test("among evidenced rows, the older last evidence comes first", () => {
    const ordered = orderEvidenceTargets([
      row("newer", 1, [10, 90]),
      row("older", 2, [40]),
    ]);
    expect(ids(ordered)).toEqual(["older", "newer"]);
  });

  test("ties fall back to createdAt, then _id", () => {
    const ordered = orderEvidenceTargets([
      row("b", 2, [5]),
      row("c", 1, [5]),
      row("a", 2, [5]),
      row("z", 3),
      row("y", 3),
    ]);
    expect(ids(ordered)).toEqual(["y", "z", "c", "a", "b"]);
  });
});

describe("evidence target rotation", () => {
  const twelve = Array.from({ length: 12 }, (_, index) => index);

  test("cycles through windows of five over twelve rows", () => {
    expect(rotateWindow(twelve, 5, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(rotateWindow(twelve, 5, 1)).toEqual([5, 6, 7, 8, 9]);
    expect(rotateWindow(twelve, 5, 2)).toEqual([10, 11]);
    expect(rotateWindow(twelve, 5, 3)).toEqual([0, 1, 2, 3, 4]);
  });

  test("one full cycle hunts every row exactly once", () => {
    const seen = [0, 1, 2].flatMap((turn) => rotateWindow(twelve, 5, turn));
    expect(seen.toSorted((a, b) => a - b)).toEqual(twelve);
  });

  test("fewer rows than the window returns the full list on every turn", () => {
    for (const turn of [0, 1, 7, 20_767]) {
      expect(rotateWindow([1, 2, 3], 5, turn)).toEqual([1, 2, 3]);
    }
  });

  test("empty input, a zero window, and a negative turn are safe", () => {
    expect(rotateWindow([], 5, 3)).toEqual([]);
    expect(rotateWindow(twelve, 0, 3)).toEqual([]);
    expect(rotateWindow(twelve, 5, -1)).toEqual([10, 11]);
  });
});
