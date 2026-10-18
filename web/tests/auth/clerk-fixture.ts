/**
 * Stands in for `@clerk/clerk-js/no-rhc`: the parts of a clerk-js instance
 * the SDK reads, driven by `?scenario=` so each test picks how load goes.
 */
type Scenario = "signed-in" | "signed-out" | "fail";
type Status = "loading" | "ready" | "error";
type Resources = {
  client: unknown;
  session: FakeSession | null;
  user: { id: string } | null;
  organization: null;
};
type Listener = (resources: Resources) => void;

interface FakeSession {
  id: string;
  status: "active";
  lastActiveToken: { jwt: { claims: Record<string, unknown> } };
  getToken: (options?: {
    template?: string;
    skipCache?: boolean;
  }) => Promise<string>;
}

export const fixtureLog = {
  constructed: [] as string[],
  loadOptions: [] as Record<string, unknown>[],
  tokenRequests: [] as { template?: string; skipCache?: boolean }[],
};

const scenario = (new URLSearchParams(window.location.search).get("scenario") ??
  "signed-in") as Scenario;

export class Clerk {
  loaded = false;
  status: Status = "loading";
  version = "fixture";
  client: unknown = undefined;
  session: FakeSession | null | undefined = undefined;
  user: { id: string } | null | undefined = undefined;
  organization: null | undefined = undefined;
  #listeners = new Set<Listener>();
  #statusHandlers = new Set<(status: Status) => void>();

  constructor(publishableKey: string) {
    fixtureLog.constructed.push(publishableKey);
  }

  async load(options: Record<string, unknown> = {}) {
    fixtureLog.loadOptions.push(options);
    // Hold the load open long enough to see what renders before it settles.
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (scenario === "fail") {
      throw new Error("fixture: Frontend API rejected the origin");
    }
    this.client = { sessions: [] };
    this.organization = null;
    if (scenario === "signed-in") {
      this.user = { id: "user_fixture" };
      this.session = {
        id: "sess_fixture",
        status: "active",
        // The SDK reads signed-in claims from the session's last token.
        lastActiveToken: {
          jwt: { claims: { sub: "user_fixture", sid: "sess_fixture" } },
        },
        getToken: async (tokenOptions = {}) => {
          fixtureLog.tokenRequests.push(tokenOptions);
          return `token-for-${tokenOptions.template ?? "session"}`;
        },
      };
    } else {
      this.user = null;
      this.session = null;
    }
    this.loaded = true;
    this.#setStatus("ready");
    this.#emit();
  }

  addListener(listener: Listener) {
    this.#listeners.add(listener);
    if (this.loaded) listener(this.#resources());
    return () => this.#listeners.delete(listener);
  }

  on(
    event: string,
    handler: (status: Status) => void,
    options?: { notify?: boolean },
  ) {
    if (event !== "status") return;
    this.#statusHandlers.add(handler);
    if (options?.notify) handler(this.status);
  }

  off(event: string, handler: (status: Status) => void) {
    if (event === "status") this.#statusHandlers.delete(handler);
  }

  __internal_updateProps() {}

  async signOut() {
    this.user = null;
    this.session = null;
    this.#emit();
  }

  #setStatus(status: Status) {
    this.status = status;
    for (const handler of this.#statusHandlers) handler(status);
  }

  #resources(): Resources {
    return {
      client: this.client,
      session: this.session ?? null,
      user: this.user ?? null,
      organization: null,
    };
  }

  #emit() {
    for (const listener of this.#listeners) listener(this.#resources());
  }
}
