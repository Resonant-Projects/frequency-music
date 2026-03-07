import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/solid-router";
import { type Component, createEffect } from "solid-js";
import { UIBadge, UIButton, UICard } from "./components/ui";
import { isLocalAuthBypassEnabled } from "./integrations/authBypass";
import {
  buildHostedSignInUrl,
  useClerkAuthSnapshot,
} from "./integrations/clerk";
import { AdminPage } from "./routes/admin";
import { CompositionsPage } from "./routes/compositions";
import { DisplayPage } from "./routes/display";
import { EssayDetailPage } from "./routes/essay-detail";
import { EssaysPage } from "./routes/essays";
import { FeedbackPage } from "./routes/feedback";
import { HypothesisDetailPage } from "./routes/hypothesis-detail";
import { HypothesesPage } from "./routes/hypotheses";
import { IngestPage } from "./routes/ingest";
import { RecipeDetailPage } from "./routes/recipe-detail";
import { RecipesPage } from "./routes/recipes";
import { WeeklyBriefDetailPage } from "./routes/weekly-brief-detail";
import { WeeklyTurnsPage } from "./routes/weekly-turns";
import { Zodiac3D } from "./routes/zodiac-3d";

const appLinks = [
  { to: "/", label: "Home" },
  { to: "/ingest", label: "Ingest" },
  { to: "/display", label: "Display" },
  { to: "/essays", label: "Essays" },
  { to: "/hypotheses", label: "Hypotheses" },
  { to: "/recipes", label: "Recipes" },
  { to: "/weekly-turns", label: "Weekly Turns" },
  { to: "/compositions", label: "Compositions" },
  { to: "/feedback", label: "Feedback" },
  { to: "/admin", label: "Admin" },
] as const;

const AppShell: Component = () => (
  <div class="app-root">
    <header class="app-header">
      <div class="app-title">
        <span class="app-title-mark">∴</span> Frequency Music
        <UIBadge tone="gold" class="app-mode-badge">
          PARK UI
        </UIBadge>
      </div>
      <nav class="app-nav">
        {appLinks.map((link) => (
          <Link
            to={link.to}
            class="app-nav-link"
            activeProps={{ class: "app-nav-link is-active" }}
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

const RootLayout: Component = () => {
  if (isLocalAuthBypassEnabled()) {
    return <AppShell />;
  }

  const auth = useClerkAuthSnapshot();

  createEffect(() => {
    const state = auth();
    if (!state.isLoaded || state.isSignedIn) return;

    const returnTo = window.location.href;
    window.location.assign(buildHostedSignInUrl(returnTo));
  });

  if (!auth().isLoaded || !auth().isSignedIn) {
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

const _PlaceholderPage = (props: {
  title: string;
  body: string;
}): Component => {
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  ingestRoute,
  displayRoute,
  essaysRoute,
  essayDetailRoute,
  hypothesesRoute,
  hypothesisDetailRoute,
  recipesRoute,
  recipeDetailRoute,
  weeklyTurnsRoute,
  weeklyBriefDetailRoute,
  compositionsRoute,
  feedbackRoute,
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
