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
import { AgentDraftsPage } from "../../src/routes/agent-drafts";
import { parseDraftReviewSearch } from "../../src/lib/draft-review-search";
import {
  setIntentRejected,
  mutationCalls,
  finishMutation,
  failMutation,
  setQueuePopulated,
  setRetired,
} from "./convex-fixture";
const root = createRootRoute({
  component: () => (
    <>
      <p>Local fixture with synthetic data. No backend connection.</p>
      <button onClick={() => setQueuePopulated(true)}>Populate queue</button>
      <button onClick={() => setRetired(true)}>Retire queue drafts</button>
      <button onClick={() => finishMutation()}>Finish mutation</button>
      <button onClick={() => finishMutation(true)}>Reject domain</button>
      <button onClick={failMutation}>Fail transport</button>
      <output aria-label="API calls">{JSON.stringify(mutationCalls())}</output>
      <a
        href="/agent-drafts?intent=second"
        onClick={(event) => {
          event.preventDefault();
          void router.navigate({
            to: "/agent-drafts",
            search: { intent: "second" },
          });
        }}
      >
        Next intent
      </a>
      <button onClick={() => setIntentRejected(true)}>
        Publish intent rejection
      </button>
      <Outlet />
    </>
  ),
});
const review = createRoute({
  getParentRoute: () => root,
  path: "/agent-drafts",
  validateSearch: parseDraftReviewSearch,
  component: AgentDraftsPage,
});
const router = createRouter({ routeTree: root.addChildren([review]) });
render(
  () => <RouterProvider router={router} />,
  document.getElementById("app")!,
);
