import { describe, expect, test } from "vite-plus/test";
import { isHumanListeningSession } from "./listeningPredicates";

describe("isHumanListeningSession", () => {
  test("user-created sessions without machine participants are human", () => {
    expect(
      isHumanListeningSession({
        createdBy: "user_1",
        participants: [{ role: "self" }],
      }),
    ).toBe(true);
    expect(
      isHumanListeningSession({ createdBy: "user_1", participants: [] }),
    ).toBe(true);
  });
  test("system-created or machine-participant sessions are not", () => {
    expect(
      isHumanListeningSession({
        createdBy: "system",
        participants: [{ role: "self" }],
      }),
    ).toBe(false);
    expect(
      isHumanListeningSession({
        createdBy: "user_1",
        participants: [{ role: "machine" }],
      }),
    ).toBe(false);
  });
});
