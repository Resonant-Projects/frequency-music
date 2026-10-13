import assert from "node:assert/strict";
import test from "node:test";
import {
  enterEssays,
  chooseEssaysSearchResult,
  finishRun,
  routeOfflineWebSocket,
} from "./driver-safety.mjs";

for (const [url, expected] of [
  ["ws://127.0.0.1:9/api/sync", "close"],
  ["ws://127.0.0.1:43123/", "forward"],
  ["wss://production.example/api/sync", "close-external"],
]) {
  test(`WebSocket policy: ${url}`, () => {
    const calls = [];
    const external = [];
    const blocked = [];
    routeOfflineWebSocket(
      {
        url: () => url,
        close: () => calls.push("close"),
        connectToServer: () => calls.push("forward"),
      },
      { port: 43123 },
      external,
      blocked,
    );
    assert.deepEqual(calls, [
      expected.startsWith("close") ? "close" : "forward",
    ]);
    assert.equal(external.length, expected === "close-external" ? 1 : 0);
    assert.equal(blocked.length, url.includes(":9/") ? 1 : 0);
  });
}

for (const failure of [null, "trace", "browser"]) {
  test(`Finalize before receipt, including ${failure || "successful teardown"}`, async () => {
    const events = [];
    const context = {
      tracing: {
        stop: async () => {
          events.push("trace");
          if (failure === "trace") throw new Error("trace volume full");
        },
      },
    };
    const browser = {
      close: async () => {
        events.push("browser");
        if (failure === "browser") throw new Error("browser close failed");
      },
    };
    const receipts = [];
    const outcome = await finishRun({
      context,
      browser,
      out: ".",
      feature: "doctor",
      result: { status: "pass" },
      writeResult: (value) => {
        events.push("receipt");
        receipts.push(value);
      },
    });
    assert.deepEqual(events, ["trace", "browser", "receipt"]);
    assert.equal(receipts[0].status, failure ? "fail" : "pass");
    assert.equal(Boolean(outcome.failure), Boolean(failure));
  });
}

test("Original journey failure stays failed after successful finalization", async () => {
  const outcome = await finishRun({
    out: ".",
    feature: "essays",
    error: new Error("assertion"),
    result: { actions: 3 },
    writeResult: (value) => assert.equal(value.status, "fail"),
  });
  assert.match(outcome.completed.error, /assertion/);
});

function navigationFixture({ href = "/essays", close = true } = {}) {
  const page = { url: "http://127.0.0.1:43123/essays/detail" };
  const trigger = {
    attributes: { "aria-expanded": "false" },
    click: async () => {
      trigger.attributes["aria-expanded"] = "true";
    },
  };
  const link = {
    attributes: { href },
    click: async () => {
      if (href !== "#") page.url = `http://127.0.0.1:43123${href}`;
      if (close) trigger.attributes["aria-expanded"] = "false";
    },
  };
  const nav = {
    getByRole: (role) => (role === "button" ? trigger : link),
    locator: () => ({
      count: () => (trigger.attributes["aria-expanded"] === "true" ? 1 : 0),
    }),
  };
  const expect = (value) => ({
    toHaveAttribute: async (key, expected) =>
      assert.equal(value.attributes[key], expected),
    toHaveURL: async (expected) => assert.equal(value.url, expected),
    toHaveCount: async (expected) => assert.equal(value.count(), expected),
  });
  return [page, nav, "http://127.0.0.1:43123", expect];
}
test("Search selection must navigate, not merely close its dialog", async () => {
  const base = "http://127.0.0.1:43123";
  const page = { url: base + "/essays/detail" };
  const dialog = { hidden: false };
  const expect = (value) => ({
    toHaveURL: async (url) => assert.equal(value.url, url),
    toBeHidden: async () => assert.equal(value.hidden, true),
  });
  const broken = {
    click: async () => {
      dialog.hidden = true;
    },
  };
  await assert.rejects(
    chooseEssaysSearchResult(broken, page, dialog, base, expect),
  );
  const working = {
    click: async () => {
      page.url = base + "/essays";
      dialog.hidden = true;
    },
  };
  await chooseEssaysSearchResult(working, page, dialog, base, expect);
});

for (const mobile of [false, true]) {
  test(`Essays entry actually navigates and closes (${mobile ? "mobile" : "desktop"})`, async () => {
    await enterEssays(...navigationFixture(), mobile);
    await assert.rejects(
      enterEssays(...navigationFixture({ href: "#" }), mobile),
    );
    await assert.rejects(
      enterEssays(...navigationFixture({ close: false }), mobile),
    );
  });
}
