import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/solid-router";
import { type Component, createEffect, createSignal, lazy } from "solid-js";
import { UIBadge, UIButton, UICard } from "./components/ui";
import { buildHostedSignInUrl, useClerkAuthSnapshot } from "./integrations/clerk";
import { AdminPage } from "./routes/admin";
import { AgentDraftsPage } from "./routes/agent-drafts";
import { AgentRunDetailPage } from "./routes/agent-run-detail";
import { AgentRunsPage } from "./routes/agent-runs";
import { CompositionDetailPage } from "./routes/composition-detail";
import { CompositionsPage } from "./routes/compositions";
import { DisplayPage } from "./routes/display";
import { EditorialDetailPage } from "./routes/editorial-detail";
import { EditorialPage } from "./routes/editorial";
import { EssaysPage } from "./routes/essays";
import { FailuresPage } from "./routes/failures";
import { FeedbackPage } from "./routes/feedback";
import { HypothesisDetailPage } from "./routes/hypothesis-detail";
import { HypothesesPage } from "./routes/hypotheses";
import { IngestPage } from "./routes/ingest";
import { RecipeDetailPage } from "./routes/recipe-detail";
import { RecipesPage } from "./routes/recipes";
import { ThesisDetailPage } from "./routes/thesis-detail";
import { ThesesPage } from "./routes/theses";
import { WeeklyTurnsPage } from "./routes/weekly-turns";

function lazyRoute<T extends Component>(
  loader: () => Promise<{ default: T }>,
): T & { preload: () => Promise<void> } {
  const component = lazy(loader) as unknown as T & {
    preload: () => Promise<void>;
  };
  component.preload = () => loader().then(() => undefined);
  return component;
}

const EssayDetailPage = lazyRoute(() =>
  import("./routes/essay-detail").then((m) => ({ default: m.EssayDetailPage })),
);

const WeeklyBriefDetailPage = lazyRoute(() =>
  import("./routes/weekly-brief-detail").then((m) => ({
    default: m.WeeklyBriefDetailPage,
  })),
);

const Zodiac3D = lazyRoute(() =>
  import("./routes/zodiac-3d").then((m) => ({ default: m.Zodiac3D })),
);

const appLinks = [
  { to: "/", label: "Home" },
  { to: "/ingest", label: "Ingest" },
  { to: "/display", label: "Display" },
  { to: "/essays", label: "Essays" },
  { to: "/hypotheses", label: "Hypotheses" },
  { to: "/theses", label: "Theses" },
  { to: "/recipes", label: "Recipes" },
  { to: "/weekly-turns", label: "Weekly Turns" },
  { to: "/compositions", label: "Compositions" },
  { to: "/editorial", label: "Editorial" },
  { to: "/failures", label: "Failures" },
  { to: "/feedback", label: "Feedback" },
  { to: "/agent-runs", label: "Agent Runs" },
  { to: "/agent-drafts", label: "Review Queue" },
  { to: "/admin", label: "Admin" },
] as const;

const AppShell: Component = () => {
  const [menuOpen, setMenuOpen] = createSignal(false);

  return (
    <div class="app-root">
      <header class="app-header">
        <div class="app-title">
          <span class="app-title-mark">∴</span> Frequency Music
          <UIBadge tone="gold" class="app-mode-badge">
            PARK UI
          </UIBadge>
        </div>
        <button
          type="button"
          class="app-nav-toggle"
          aria-expanded={menuOpen()}
          aria-controls="app-nav-menu"
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          ≡
        </button>
        <nav id="app-nav-menu" class="app-nav" classList={{ "is-open": menuOpen() }}>
          {appLinks.map((link) => (
            <Link
              to={link.to}
              class="app-nav-link"
              activeProps={{ class: "app-nav-link is-active" }}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main class="app-main">
        <Outlet />
      </main>
    </div>
  );
};

const authBypass = import.meta.env.VITE_AUTH_BYPASS === "1";

const RootLayout: Component = () => {
  const auth = useClerkAuthSnapshot();

  createEffect(() => {
    if (authBypass) return;
    const state = auth();
    if (!state.isLoaded || state.isSignedIn) return;

    const returnTo = window.location.href;
    window.location.assign(buildHostedSignInUrl(returnTo));
  });

  if (!authBypass && (!auth().isLoaded || !auth().isSignedIn)) {
    return (
      <div class="route-placeholder">
        <UICard class="route-placeholder-card">
          <UIBadge tone="violet">Authentication</UIBadge>
          <h1>Redirecting to sign in...</h1>
          <p>
            This app requires authentication. You&apos;ll be redirected to login.resonantrhythm.com.
          </p>
        </UICard>
      </div>
    );
  }

  return <AppShell />;
};

const _PlaceholderPage = (props: { title: string; body: string }): Component => {
  const Page: Component = () => (
    <div class="route-placeholder">
      <UICard class="route-placeholder-card">
        <UIBadge tone="violet">Checkpoint</UIBadge>
        <h1>{props.title}</h1>
        <p>{props.body}</p>
        <UIButton variant="outline" disabled>
          Coming Next
        </UIButton>
      </UICard>
    </div>
  );
  return Page;
};

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Zodiac3D,
});

const ingestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ingest",
  component: IngestPage,
});

const displayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/display",
  component: DisplayPage,
});

const essaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/essays",
  component: EssaysPage,
});

const essayDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/essays/$essaySlug",
  component: EssayDetailPage,
});

const hypothesesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hypotheses",
  component: HypothesesPage,
});

const hypothesisDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hypotheses/$hypothesisId",
  component: HypothesisDetailPage,
});

const recipesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes",
  component: RecipesPage,
});

const thesesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/theses",
  component: ThesesPage,
});

const thesisDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/theses/$thesisId",
  component: ThesisDetailPage,
});

const recipeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes/$recipeId",
  component: RecipeDetailPage,
});

const weeklyTurnsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/weekly-turns",
  component: WeeklyTurnsPage,
});

const weeklyBriefDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/weekly-turns/$briefId",
  component: WeeklyBriefDetailPage,
});

const compositionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/compositions",
  component: CompositionsPage,
});

const editorialRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/editorial",
  component: EditorialPage,
});

const editorialDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/editorial/$artifactId",
  component: EditorialDetailPage,
});

const compositionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/compositions/$compositionId",
  component: CompositionDetailPage,
});

const failuresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/failures",
  component: FailuresPage,
});

const feedbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/feedback",
  component: FeedbackPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const agentRunsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agent-runs",
  component: AgentRunsPage,
});

const agentRunDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agent-runs/$runId",
  component: AgentRunDetailPage,
});

const agentDraftsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/agent-drafts",
  component: AgentDraftsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  ingestRoute,
  displayRoute,
  essaysRoute,
  essayDetailRoute,
  hypothesesRoute,
  hypothesisDetailRoute,
  thesesRoute,
  thesisDetailRoute,
  recipesRoute,
  recipeDetailRoute,
  weeklyTurnsRoute,
  weeklyBriefDetailRoute,
  compositionsRoute,
  editorialRoute,
  editorialDetailRoute,
  compositionDetailRoute,
  failuresRoute,
  feedbackRoute,
  agentRunsRoute,
  agentRunDetailRoute,
  agentDraftsRoute,
  adminRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
