import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/solid-router";
import { type Component, createEffect, createSignal, lazy } from "solid-js";
import { UIBadge, UICard } from "./components/ui";
import {
  buildHostedSignInUrl,
  useClerkAuthSnapshot,
} from "./integrations/clerk";
import { CompositionsPage } from "./routes/compositions";
import { CorrespondencesPage } from "./routes/correspondences";
import { DisplayPage } from "./routes/display";
import { EditorialPage } from "./routes/editorial";
import { FailuresPage } from "./routes/failures";
import { HypothesisDetailPage } from "./routes/hypothesis-detail";
import { HypothesesPage } from "./routes/hypotheses";
import { RecipesPage } from "./routes/recipes";
import { ThesesPage } from "./routes/theses";

function lazyRoute<T extends Component>(
  loader: () => Promise<{ default: T }>,
): T & { preload: () => Promise<void> } {
  const component = lazy(loader) as unknown as T & {
    preload: () => Promise<void>;
  };
  component.preload = () => loader().then(() => undefined);
  return component;
}

const AdminPage = lazyRoute(() =>
  import("./routes/admin").then((m) => ({ default: m.AdminPage })),
);

const AgentDraftsPage = lazyRoute(() =>
  import("./routes/agent-drafts").then((m) => ({ default: m.AgentDraftsPage })),
);

const AgentRunDetailPage = lazyRoute(() =>
  import("./routes/agent-run-detail").then((m) => ({
    default: m.AgentRunDetailPage,
  })),
);

const AgentRunsPage = lazyRoute(() =>
  import("./routes/agent-runs").then((m) => ({ default: m.AgentRunsPage })),
);

const CompositionDetailPage = lazyRoute(() =>
  import("./routes/composition-detail").then((m) => ({
    default: m.CompositionDetailPage,
  })),
);

const CorrespondenceDetailPage = lazyRoute(() =>
  import("./routes/correspondence-detail").then((m) => ({
    default: m.CorrespondenceDetailPage,
  })),
);

const EditorialDetailPage = lazyRoute(() =>
  import("./routes/editorial-detail").then((m) => ({
    default: m.EditorialDetailPage,
  })),
);

const EssaysPage = lazyRoute(() =>
  import("./routes/essays").then((m) => ({ default: m.EssaysPage })),
);

const EssayDetailPage = lazyRoute(() =>
  import("./routes/essay-detail").then((m) => ({ default: m.EssayDetailPage })),
);

const FeedbackPage = lazyRoute(() =>
  import("./routes/feedback").then((m) => ({ default: m.FeedbackPage })),
);

const IngestPage = lazyRoute(() =>
  import("./routes/ingest").then((m) => ({ default: m.IngestPage })),
);

const RecipeDetailPage = lazyRoute(() =>
  import("./routes/recipe-detail").then((m) => ({
    default: m.RecipeDetailPage,
  })),
);

const ThesisDetailPage = lazyRoute(() =>
  import("./routes/thesis-detail").then((m) => ({
    default: m.ThesisDetailPage,
  })),
);

const VocabularyTriagePage = lazyRoute(() =>
  import("./routes/vocabulary-triage").then((m) => ({
    default: m.VocabularyTriagePage,
  })),
);

const WeeklyTurnsPage = lazyRoute(() =>
  import("./routes/weekly-turns").then((m) => ({
    default: m.WeeklyTurnsPage,
  })),
);

const WeeklyBriefDetailPage = lazyRoute(() =>
  import("./routes/weekly-brief-detail").then((m) => ({
    default: m.WeeklyBriefDetailPage,
  })),
);

const Zodiac3D = lazyRoute(() =>
  import("./routes/zodiac-3d").then((m) => ({ default: m.Zodiac3D })),
);

// `/` is the 3D home, so warm its chunk immediately rather than waterfalling
// the download behind the first navigation. This is only an optimization: a
// failed prefetch must stay silent, or every route logs an unhandled rejection
// when the network blips. Navigating to `/` retries the import and surfaces
// any real failure there.
if (typeof window !== "undefined") {
  void Zodiac3D.preload().catch(() => undefined);
}

const appLinks = [
  { to: "/", label: "Home" },
  { to: "/ingest", label: "Ingest" },
  { to: "/display", label: "Display" },
  { to: "/essays", label: "Essays" },
  { to: "/hypotheses", label: "Hypotheses" },
  { to: "/theses", label: "Theses" },
  { to: "/recipes", label: "Recipes" },
  { to: "/correspondences", label: "Correspondences" },
  { to: "/weekly-turns", label: "Weekly Turns" },
  { to: "/compositions", label: "Compositions" },
  { to: "/editorial", label: "Editorial" },
  { to: "/failures", label: "Failures" },
  { to: "/feedback", label: "Feedback" },
  { to: "/agent-runs", label: "Agent Runs" },
  { to: "/agent-drafts", label: "Review Queue" },
  { to: "/vocabulary-triage", label: "Triage" },
  { to: "/admin", label: "Admin" },
] as const;

const AppShell: Component = () => {
  const [menuOpen, setMenuOpen] = createSignal(false);

  return (
    <div class="app-root">
      <header class="app-header">
        <div class="app-title">
          <span class="app-title-mark">∴</span> Frequency Music
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
        <nav
          id="app-nav-menu"
          class="app-nav"
          classList={{ "is-open": menuOpen() }}
        >
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
            This app requires authentication. You&apos;ll be redirected to
            login.resonantrhythm.com.
          </p>
        </UICard>
      </div>
    );
  }

  return <AppShell />;
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

const correspondenceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/correspondences/$correspondenceId",
  component: CorrespondenceDetailPage,
});

const correspondencesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/correspondences",
  component: CorrespondencesPage,
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

const vocabularyTriageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vocabulary-triage",
  component: VocabularyTriagePage,
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
  correspondencesRoute,
  correspondenceDetailRoute,
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
  vocabularyTriageRoute,
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
