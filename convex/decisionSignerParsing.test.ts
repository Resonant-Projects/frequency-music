import { describe, expect, it } from "vite-plus/test";
import {
  parseDecisionCallback,
  parseDecisionCode,
  readSignerBody,
} from "./decisionSignerParsing";

describe("decision wire syntax", () => {
  it("accepts only confirm plus digest and digest-free cancel", () => {
    expect(parseDecisionCallback("intent_1:confirm:0123abcd")).toEqual({
      intentId: "intent_1",
      verb: "confirm",
      digest8: "0123abcd",
    });
    expect(parseDecisionCallback("intent_1:cancel")).toEqual({
      intentId: "intent_1",
      verb: "cancel",
    });
    for (const value of [
      null,
      {},
      "i:approve:0123abcd",
      "i:confirm",
      "i:confirm:ABCDEF12",
      "i:confirm:0123abcd:extra",
      "i:cancel:0123abcd",
      " i:cancel",
      "i:cancel\n",
      `${"i".repeat(41)}:cancel`,
    ])
      expect(parseDecisionCallback(value)).toBeNull();
  });
  it("requires exact typed code syntax", () => {
    expect(parseDecisionCode("confirm D-17")).toEqual({
      verb: "confirm",
      code: "D-17",
    });
    expect(parseDecisionCode("cancel D-17")).toEqual({
      verb: "cancel",
      code: "D-17",
    });
    for (const value of [
      "Confirm D-17",
      "confirm D-0",
      "confirm D-017",
      "confirm  D-17",
      "confirm D-17\n",
      "/confirm D-17",
      "confirm D-17 please",
      "cancel D-1:confirm:12345678",
    ])
      expect(parseDecisionCode(value)).toBeNull();
  });
  it("caps body bytes without trusting content-length", async () => {
    expect(
      await readSignerBody(
        new Request("https://example.test", {
          method: "POST",
          body: "x".repeat(65_537),
        }),
      ),
    ).toBeNull();
  });
});
