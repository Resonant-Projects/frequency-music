// FIXTURE: real Listen and Docket routes over a synthetic Convex adapter.
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/solid-router";
import { render } from "solid-js/web";
import "../../src/index.css";
import "../../styled-system/styles.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/jetbrains-mono/400.css";
import { DocketPage } from "../../src/routes/docket";
import { ListenPage } from "../../src/routes/listen";
import { calls, releaseHeld, setMode, setState } from "./convex-fixture";

Object.assign(window, {
  feedbackFixture: { setState, setMode, releaseHeld, calls },
});
const root = createRootRoute({
  component: () => (
    <>
      <p data-fixture-banner>
        Local fixture with synthetic data. No backend connection.
      </p>
      <Outlet />
    </>
  ),
});
const listen = createRoute({
  getParentRoute: () => root,
  path: "/listen",
  component: ListenPage,
});
const docket = createRoute({
  getParentRoute: () => root,
  path: "/docket",
  component: DocketPage,
});
const router = createRouter({
  routeTree: root.addChildren([listen, docket]),
});
render(
  () => <RouterProvider router={router} />,
  document.getElementById("app")!,
);
