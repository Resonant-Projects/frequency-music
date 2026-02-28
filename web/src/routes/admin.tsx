import { createSignal, For, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard, UIInput } from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import {
  createAction,
  createMutation,
  createQuery,
} from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

type FeedRow = {
  _id: string;
  name?: string;
  type: string;
  url: string;
  enabled?: boolean;
};

const pageClass = css({
  display: "grid",
  gap: "6",
  p: { base: "4", md: "6" },
});

const sectionTitleClass = css({
  color: "zodiac.gold",
  fontSize: "lg",
  letterSpacing: "0.12em",
  marginBottom: "3",
  textTransform: "uppercase",
});

const fieldLabelClass = css({
  color: "rgba(245, 240, 232, 0.75)",
  display: "block",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  marginBottom: "1.5",
  textTransform: "uppercase",
});

export function AdminPage() {
  const snapshot = createQuery(convexApi.admin.workspaceSnapshot);
  const feeds = createQuery(convexApi.admin.listFeeds);

  const createFeed = createMutation(convexApi.admin.createFeed);
  const setFeedEnabled = createMutation(convexApi.admin.setFeedEnabled);
  const pollFeedsNow = createAction(convexApi.admin.pollFeedsNow);
  const setSourceStatus = createMutation(convexApi.admin.setSourceStatus);

  const [feedName, setFeedName] = createSignal("");
  const [feedUrl, setFeedUrl] = createSignal("");
  const [feedType, setFeedType] = createSignal("rss");

  const [sourceId, setSourceId] = createSignal("");
  const [sourceStatus, setSourceStatusValue] = createSignal("review_needed");
  const [notice, setNotice] = createSignal<string | null>(null);

  async function submitFeed(event: SubmitEvent) {
    event.preventDefault();

    if (!feedName().trim() || !feedUrl().trim()) {
      setNotice("Feed name and URL are required.");
      return;
    }

    try {
      await createFeed(
        withDevBypassSecret({
          name: feedName().trim(),
          url: feedUrl().trim(),
          type: feedType() as "rss" | "podcast" | "youtube",
        }),
      );
      setFeedName("");
      setFeedUrl("");
      setNotice("Feed created.");
    } catch (error) {
      setNotice(`Feed creation failed: ${String(error)}`);
    }
  }

  async function toggleFeed(id: string, enabled: boolean) {
    try {
      await setFeedEnabled(
        withDevBypassSecret({ id: id as Id<"feeds">, enabled: !enabled }),
      );
      setNotice("Feed state updated.");
    } catch (error) {
      setNotice(`Failed to toggle feed: ${String(error)}`);
    }
  }

  async function runPoll() {
    try {
      await pollFeedsNow(withDevBypassSecret({}));
      setNotice("Feed poll started.");
    } catch (error) {
      setNotice(`Feed poll failed: ${String(error)}`);
    }
  }

  async function submitSourceStatus(event: SubmitEvent) {
    event.preventDefault();

    if (!sourceId().trim()) {
      setNotice("Source ID is required.");
      return;
    }

    try {
      await setSourceStatus(
        withDevBypassSecret({
          id: sourceId().trim() as Id<"sources">,
          status: sourceStatus(),
        }),
      );
      setNotice("Source status updated.");
    } catch (error) {
      setNotice(`Source status update failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <div
          class={css({
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            gap: "3",
          })}
        >
          <div>
            <h1 class={sectionTitleClass}>Admin</h1>
            <p
              class={css({
                color: "rgba(245, 240, 232, 0.62)",
                lineHeight: "1.6",
              })}
            >
              Feed controls, workspace metrics, and operational overrides.
            </p>
          </div>
          <UIButton variant="outline" onClick={runPoll}>
            Poll Feeds Now
          </UIButton>
        </div>

        <Show when={notice()}>
          {(message) => (
            <p class={css({ color: "zodiac.cream", marginTop: "3" })}>
              {message()}
            </p>
          )}
        </Show>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Workspace Snapshot</h2>
        <div
          class={css({
            display: "grid",
            gap: "3",
            gridTemplateColumns: {
              base: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
            },
          })}
        >
          <div>
            <UIBadge tone="gold">Sources</UIBadge>
            <p>{snapshot()?.sources ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="violet">Hypotheses</UIBadge>
            <p>{snapshot()?.hypotheses ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="cream">Recipes</UIBadge>
            <p>{snapshot()?.recipes ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="gold">Compositions</UIBadge>
            <p>{snapshot()?.compositions ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="violet">Weekly Briefs</UIBadge>
            <p>{snapshot()?.weeklyBriefs ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="cream">Feeds</UIBadge>
            <p>{snapshot()?.feeds ?? 0}</p>
          </div>
        </div>
      </UICard>

      <UICard as="form" onSubmit={submitFeed}>
        <h2 class={sectionTitleClass}>Add Feed</h2>

        <label class={fieldLabelClass} for="admin-feed-name">
          Feed Name
        </label>
        <UIInput
          id="admin-feed-name"
          value={feedName()}
          onInput={(event) => setFeedName(event.currentTarget.value)}
          placeholder="Quanta"
        />

        <label class={fieldLabelClass} for="admin-feed-url">
          Feed URL
        </label>
        <UIInput
          id="admin-feed-url"
          value={feedUrl()}
          onInput={(event) => setFeedUrl(event.currentTarget.value)}
          placeholder="https://example.com/feed.xml"
        />

        <label class={fieldLabelClass} for="admin-feed-type">
          Type
        </label>
        <select
          id="admin-feed-type"
          value={feedType()}
          onChange={(event) => setFeedType(event.currentTarget.value)}
          class={css({
            bg: "rgba(26, 15, 53, 0.45)",
            borderColor: "rgba(200, 168, 75, 0.28)",
            borderRadius: "l2",
            borderWidth: "1px",
            color: "zodiac.cream",
            minH: "10",
            px: "3",
            width: "full",
          })}
        >
          <option value="rss">rss</option>
          <option value="podcast">podcast</option>
          <option value="youtube">youtube</option>
        </select>

        <div
          class={css({
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "3",
          })}
        >
          <UIButton type="submit" variant="solid">
            Add Feed
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Feed List</h2>
        <div class={css({ display: "grid", gap: "2" })}>
          <For each={feeds() ?? []}>
            {(feed: FeedRow) => (
              <div
                class={css({
                  alignItems: "center",
                  borderColor: "rgba(200, 168, 75, 0.24)",
                  borderRadius: "l2",
                  borderWidth: "1px",
                  display: "flex",
                  gap: "2",
                  justifyContent: "space-between",
                  p: "3",
                })}
              >
                <div>
                  <p class={css({ margin: 0 })}>{feed.name}</p>
                  <p
                    class={css({
                      color: "rgba(245, 240, 232, 0.58)",
                      fontFamily: "mono",
                      fontSize: "xs",
                      margin: 0,
                    })}
                  >
                    {feed.type} · {feed.url}
                  </p>
                </div>
                <UIButton
                  variant="outline"
                  onClick={() =>
                    toggleFeed(String(feed._id), Boolean(feed.enabled))
                  }
                >
                  {feed.enabled ? "Disable" : "Enable"}
                </UIButton>
              </div>
            )}
          </For>
        </div>
      </UICard>

      <UICard as="form" onSubmit={submitSourceStatus}>
        <h2 class={sectionTitleClass}>Source Override</h2>
        <label class={fieldLabelClass} for="admin-source-id">
          Source ID
        </label>
        <UIInput
          id="admin-source-id"
          value={sourceId()}
          onInput={(event) => setSourceId(event.currentTarget.value)}
          placeholder="k57..."
        />

        <label class={fieldLabelClass} for="admin-source-status">
          Status
        </label>
        <select
          id="admin-source-status"
          value={sourceStatus()}
          onChange={(event) => setSourceStatusValue(event.currentTarget.value)}
          class={css({
            bg: "rgba(26, 15, 53, 0.45)",
            borderColor: "rgba(200, 168, 75, 0.28)",
            borderRadius: "l2",
            borderWidth: "1px",
            color: "zodiac.cream",
            minH: "10",
            px: "3",
            width: "full",
          })}
        >
          <option value="ingested">ingested</option>
          <option value="text_ready">text_ready</option>
          <option value="extracting">extracting</option>
          <option value="review_needed">review_needed</option>
          <option value="triaged">triaged</option>
          <option value="archived">archived</option>
        </select>

        <div
          class={css({
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "3",
          })}
        >
          <UIButton type="submit" variant="solid">
            Apply Status
          </UIButton>
        </div>
      </UICard>
    </section>
  );
}
