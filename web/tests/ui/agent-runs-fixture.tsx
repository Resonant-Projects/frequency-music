// Real Agent Runs route over the synthetic adapter; no Convex client.
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/solid-router";
import { render } from "solid-js/web";
import "../../src/index.css";
import "../../styled-system/styles.css";
import { AgentRunsPage } from "../../src/routes/agent-runs";
import { runQueries } from "./convex-fixture";

Object.assign(window, { agentRunsFixture: { runQueries } });
const root = createRootRoute();
const route = createRoute({
  getParentRoute: () => root,
  path: "/agent-runs",
  component: AgentRunsPage,
});
const router = createRouter({ routeTree: root.addChildren([route]) });
render(
  () => <RouterProvider router={router} />,
  document.getElementById("app")!,
);
