import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/solid-router";
import { Component } from "solid-js";
import { UIBadge, UIButton, UICard } from "./components/ui";
import { DisplayPage } from "./routes/display";
import { HypothesesPage } from "./routes/hypotheses";
import { IngestPage } from "./routes/ingest";
import { RecipesPage } from "./routes/recipes";
import { WeeklyTurnsPage } from "./routes/weekly-turns";
import { Zodiac3D } from "./routes/zodiac-3d";

const appLinks = [
  { to: "/", label: "Home" },
  { to: "/ingest", label: "Ingest" },
  { to: "/display", label: "Display" },
  { to: "/hypotheses", label: "Hypotheses" },
  { to: "/recipes", label: "Recipes" },
  { to: "/weekly-turns", label: "Weekly Turns" },
  { to: "/compositions", label: "Compositions" },
  { to: "/feedback", label: "Feedback" },
  { to: "/admin", label: "Admin" },
] as const;

const RootLayout: Component = () => {
  return (
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
};

const PlaceholderPage = (props: { title: string; body: string }): Component => {
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

const hypothesesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hypotheses",
  component: HypothesesPage,
});

const recipesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes",
  component: RecipesPage,
});

const weeklyTurnsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/weekly-turns",
  component: WeeklyTurnsPage,
});

const compositionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/compositions",
  component: PlaceholderPage({
    title: "Compositions",
    body: "Composition workflow pages will be implemented here.",
  }),
});

const feedbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/feedback",
  component: PlaceholderPage({
    title: "Feedback",
    body: "Listening sessions and subjective metrics will be captured here.",
  }),
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: PlaceholderPage({
    title: "Admin",
    body: "Admin settings and feed controls will be implemented here.",
  }),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  ingestRoute,
  displayRoute,
  hypothesesRoute,
  recipesRoute,
  weeklyTurnsRoute,
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
