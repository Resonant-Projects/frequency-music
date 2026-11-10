// @vitest-environment node
import { makeFunctionReference } from "convex/server";
import { createRoot, createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createQuery, createQueryWithStatus } from "./query";

type Listener = {
  args: unknown;
  onResult: (value: unknown) => void;
  onError?: (error: Error) => void;
};
const subscriptions: Listener[] = [];
let oneShot: () => Promise<unknown> = () => new Promise(() => {});
const client = {
  onUpdate(
    _query: unknown,
    args: unknown,
    onResult: Listener["onResult"],
    onError?: Listener["onError"],
  ) {
    subscriptions.push({ args, onResult, onError });
    return () => {};
  },
  query: () => oneShot(),
};
vi.mock("./provider", () => ({ useConvexClient: () => client }));

const listQuery = makeFunctionReference<"query", { id: string }, string>(
  "items:list",
);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  subscriptions.length = 0;
  oneShot = () => new Promise(() => {});
});

/** Effects run when the root settles, so set up inside it and act outside. */
function mount<T>(setup: () => T): T & { dispose: () => void } {
  return createRoot((dispose) => ({ ...setup(), dispose }));
}

describe("query argument identity", () => {
  it("keeps one subscription and its data when equal args are rebuilt", () => {
    const view = mount(() => {
      const [tick, setTick] = createSignal(0);
      const args = () => {
        tick();
        return { id: "a" };
      };
      return {
        setTick,
        status: createQueryWithStatus(listQuery, args),
        plain: createQuery(listQuery, args),
      };
    });
    for (const listener of subscriptions) listener.onResult("first");
    view.setTick(1);
    expect(subscriptions).toHaveLength(2);
    expect(view.status.data()).toBe("first");
    expect(view.plain()).toBe("first");
    view.dispose();
  });

  it("resubscribes when the args change", () => {
    const view = mount(() => {
      const [id, setId] = createSignal("a");
      createQueryWithStatus(listQuery, () => ({ id: id() }));
      return { setId };
    });
    view.setId("b");
    expect(subscriptions.map((listener) => listener.args)).toEqual([
      { id: "a" },
      { id: "b" },
    ]);
    view.dispose();
  });
});

describe("a query the backend does not have", () => {
  it("reports an error and no data, without throwing", async () => {
    const missing = new Error("Could not find public function for 'x:y'");
    oneShot = () => Promise.reject(missing);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = mount(() => ({
      status: createQueryWithStatus(listQuery, () => ({ id: "a" })),
    }));
    expect(subscriptions).toHaveLength(1);
    subscriptions[0]?.onError?.(missing);
    await flush();
    expect(view.status.data()).toBeUndefined();
    expect(view.status.error()?.message).toContain("Could not find");
    expect(view.status.isLoading()).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    view.dispose();
    log.mockRestore();
  });
});
