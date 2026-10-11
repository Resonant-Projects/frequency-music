import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/solid-router";
import {
  type Component,
  createEffect,
  createSignal,
  lazy,
  onMount,
  onCleanup,
} from "solid-js";
import { AppNavigation } from "./components/app-navigation";
import { appLinks } from "./lib/app-navigation";
import { SiteSearch } from "./components/site-search";
import { SpaceNavigationProvider } from "./lib/space-navigation";
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

const ListenPage = lazyRoute(() =>
  import("./routes/listen").then((m) => ({ default: m.ListenPage })),
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

// `/` is the 3D home, so warm its 600 kB chunk immediately when that is the
// landing route rather than waterfalling the download behind the first paint;
// every other route leaves it to `defaultPreload: "intent"`. This is only an optimization: a
// failed prefetch must stay silent, or every route logs an unhandled rejection
// when the network blips. Navigating to `/` retries the import and surfaces
// any real failure there.
if (typeof window !== "undefined" && window.location.pathname === "/") {
  void Zodiac3D.preload().catch(() => undefined);
}

const AppShell: Component = () => {
  const [menu, setMenu] = createSignal("");
  let header!: HTMLElement;
  onMount(() => {
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        "--app-header-height",
        `${header.offsetHeight}px`,
      );
    });
    observer.observe(header);
    onCleanup(() => observer.disconnect());
  });

  return (
    <SpaceNavigationProvider>
      <div class="app-root">
        <header
          ref={(element) => {
            header = element;
          }}
          class="app-header"
        >
          <div class="app-title">
            <span class="app-title-mark">∴</span> Frequency Music
          </div>
          <AppNavigation value={menu()} onValueChange={setMenu} />
          <SiteSearch pages={appLinks} onOpen={() => setMenu("")} />
        </header>
        <main class="app-main">
          <Outlet />
        </main>
      </div>
    </SpaceNavigationProvider>
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

const listenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/listen",
  component: ListenPage,
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
  listenRoute,
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
