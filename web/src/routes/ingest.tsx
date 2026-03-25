import { createSignal, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  fieldLabelClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UISelect,
  UITextarea,
} from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import {
  createAction,
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const twoColClass = css({
  display: "grid",
  gap: "4",
  gridTemplateColumns: { base: "1fr", lg: "1fr 1fr" },
});

const helperClass = css({
  color: "rgba(245, 240, 232, 0.58)",
  fontSize: "sm",
  lineHeight: "1.6",
});

const sourceListClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: { base: "1fr", md: "repeat(2, minmax(0, 1fr))" },
});

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

export function IngestPage() {
  onMount(() => { document.title = "Ingest — Frequency Music"; });

  type FeedRow = {
    _id: string;
    name?: string;
    type: string;
    url: string;
    enabled?: boolean;
  };
  type RecentSourceRow = {
    _id: Id<"sources">;
    type: string;
    status: string;
    title?: string;
    canonicalUrl?: string;
    updatedAt: number;
  };
  const [urlTitle, setUrlTitle] = createSignal("");
  const [urlValue, setUrlValue] = createSignal("");
  const [urlRawText, setUrlRawText] = createSignal("");
  const [urlTags, setUrlTags] = createSignal("");

  const [ytTitle, setYtTitle] = createSignal("");
  const [ytValue, setYtValue] = createSignal("");
  const [ytTranscript, setYtTranscript] = createSignal("");
  const [ytTags, setYtTags] = createSignal("");

  const [feedName, setFeedName] = createSignal("");
  const [feedUrl, setFeedUrl] = createSignal("");
  const [feedType, setFeedType] = createSignal("rss");

  const [notice, setNotice] = createSignal<string | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const createFromUrlInput = createAction(
    convexApi.sources.createFromUrlAndQueue,
  );
  const createFromYouTubeInput = createAction(
    convexApi.sources.createFromYouTubeAndQueue,
  );
  const createFeed = createMutation(convexApi.admin.createFeed);
  const setFeedEnabled = createMutation(convexApi.admin.setFeedEnabled);
  const pollFeedsNow = createAction(convexApi.admin.pollFeedsNow);
  const feeds = createQuery(convexApi.admin.listFeeds);

  const recentSources = createQueryWithStatus(
    convexApi.sources.listRecent,
    () => ({
      limit: 14,
    }),
  );

  async function submitUrl(event: SubmitEvent) {
    event.preventDefault();

    if (!urlValue().trim()) {
      setNotice("URL is required.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const result = await createFromUrlInput(
        withDevBypassSecret({
          url: urlValue().trim(),
          title: urlTitle().trim() || undefined,
          rawText: urlRawText().trim() || undefined,
          tags: urlTags()
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      );

      setNotice(
        result.queued
          ? result.created
            ? `URL source ingested and extraction queued (${result.workflowId ?? "workflow pending"}).`
            : `URL source updated and extraction re-queued (${result.workflowId ?? "workflow pending"}).`
          : result.created
            ? "URL source ingested into private inbox."
            : "URL unchanged; no new extraction queued.",
      );
      setUrlTitle("");
      setUrlValue("");
      setUrlRawText("");
      setUrlTags("");
    } catch (error) {
      setNotice(`URL ingest failed: ${String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitYouTube(event: SubmitEvent) {
    event.preventDefault();

    if (!ytValue().trim()) {
      setNotice("YouTube URL is required.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const result = await createFromYouTubeInput(
        withDevBypassSecret({
          url: ytValue().trim(),
          title: ytTitle().trim() || undefined,
          transcript: ytTranscript().trim() || undefined,
          tags: ytTags()
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      );

      setNotice(
        result.queued
          ? result.created
            ? `YouTube source ingested and extraction queued (${result.workflowId ?? "workflow pending"}).`
            : `YouTube source updated and extraction re-queued (${result.workflowId ?? "workflow pending"}).`
          : result.created
            ? "YouTube source ingested into private inbox."
            : "YouTube source unchanged; no new extraction queued.",
      );
      setYtTitle("");
      setYtValue("");
      setYtTranscript("");
      setYtTags("");
    } catch (error) {
      setNotice(`YouTube ingest failed: ${String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitFeed(event: SubmitEvent) {
    event.preventDefault();

    if (!feedName().trim() || !feedUrl().trim()) {
      setNotice("Feed name and URL are required.");
      return;
    }

    setIsSubmitting(true);

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
    } finally {
      setIsSubmitting(false);
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

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Ingest Console</h1>
        <p class={helperClass}>
          Add research inputs directly into Convex. URL and YouTube entries are
          dedupe-safe and land in the private inbox pipeline.
        </p>
        <div aria-live="polite">
          <Show when={notice()}>
            {(message) => (
              <p class={css({ color: "zodiac.cream", marginTop: "3" })}>
                {message()}
              </p>
            )}
          </Show>
        </div>
      </UICard>

      <UICard>
        <div
          class={css({
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "3",
          })}
        >
          <h2 class={sectionTitleClass}>Feed Intake</h2>
          <UIButton
            data-testid="ingest-poll-feeds-btn"
            variant="outline"
            onClick={runPoll}
          >
            Poll Feeds Now
          </UIButton>
        </div>
        <p class={helperClass}>
          Manage automated feed intake here. Add feeds, enable/disable them, and
          trigger a poll when you need immediate refresh.
        </p>

        <div class={twoColClass}>
          <UICard
            as="form"
            data-testid="ingest-feed-form"
            onSubmit={submitFeed as any}
            class={css({ bg: "rgba(13, 6, 32, 0.38)" })}
          >
            <h3 class={sectionTitleClass}>Add Feed</h3>

            <label class={fieldLabelClass} for="ingest-feed-name">
              Feed Name
            </label>
            <UIInput
              id="ingest-feed-name"
              value={feedName()}
              onInput={(event) => setFeedName(event.currentTarget.value)}
              placeholder="Quanta"
            />

            <label class={fieldLabelClass} for="ingest-feed-url">
              Feed URL
            </label>
            <UIInput
              id="ingest-feed-url"
              value={feedUrl()}
              onInput={(event) => setFeedUrl(event.currentTarget.value)}
              placeholder="https://example.com/feed.xml"
            />

            <label class={fieldLabelClass} for="ingest-feed-type">
              Type
            </label>
            <UISelect
              id="ingest-feed-type"
              value={feedType()}
              onChange={(event) => setFeedType(event.currentTarget.value)}
            >
              <option value="rss">rss</option>
              <option value="podcast">podcast</option>
              <option value="youtube">youtube</option>
            </UISelect>

            <div
              class={css({
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "3",
              })}
            >
              <UIButton type="submit" variant="solid" disabled={isSubmitting()}>
                Add Feed
              </UIButton>
            </div>
          </UICard>

          <UICard class={css({ bg: "rgba(13, 6, 32, 0.38)" })}>
            <div
              class={css({
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "2",
              })}
            >
              <h3 class={sectionTitleClass}>Feed List</h3>
              <UIBadge tone="violet">{(feeds() ?? []).length} feeds</UIBadge>
            </div>
            <div
              class={`${css({
                display: "grid",
                gap: "2",
                maxH: "96",
                overflowY: "auto",
                overflowX: "hidden",
              })} zodiac-scroll`}
            >
              <For each={feeds() ?? []}>
                {(feed: FeedRow) => (
                  <div
                    data-testid="ingest-feed-row"
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
                    <div class={css({ minW: 0, overflow: "hidden" })}>
                      <p class={css({ margin: 0 })}>{feed.name}</p>
                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.58)",
                          fontFamily: "mono",
                          fontSize: "xs",
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
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
        </div>
      </UICard>

      <div class={twoColClass}>
        <UICard as="form" onSubmit={submitUrl as any}>
          <h2 class={sectionTitleClass}>URL Ingest</h2>

          <label class={fieldLabelClass} for="url-input-url">
            Source URL
          </label>
          <UIInput
            id="url-input-url"
            value={urlValue()}
            onInput={(event) => setUrlValue(event.currentTarget.value)}
            placeholder="https://example.com/article"
          />

          <label class={fieldLabelClass} for="url-input-title">
            Optional Title
          </label>
          <UIInput
            id="url-input-title"
            value={urlTitle()}
            onInput={(event) => setUrlTitle(event.currentTarget.value)}
            placeholder="Spectral roughness in harmonic fields"
          />

          <label class={fieldLabelClass} for="url-input-tags">
            Tags (comma separated)
          </label>
          <UIInput
            id="url-input-tags"
            value={urlTags()}
            onInput={(event) => setUrlTags(event.currentTarget.value)}
            placeholder="resonance, psychoacoustics"
          />

          <label class={fieldLabelClass} for="url-input-raw-text">
            Optional text excerpt
          </label>
          <UITextarea
            id="url-input-raw-text"
            value={urlRawText()}
            onInput={(event) => setUrlRawText(event.currentTarget.value)}
            placeholder="Paste text if fetch step is not automated yet"
          />

          <div
            class={css({
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "4",
            })}
          >
            <UIButton type="submit" variant="solid" disabled={isSubmitting()}>
              Ingest URL
            </UIButton>
          </div>
        </UICard>

        <UICard as="form" onSubmit={submitYouTube as any}>
          <h2 class={sectionTitleClass}>YouTube Ingest</h2>

          <label class={fieldLabelClass} for="yt-input-url">
            YouTube URL
          </label>
          <UIInput
            id="yt-input-url"
            value={ytValue()}
            onInput={(event) => setYtValue(event.currentTarget.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />

          <label class={fieldLabelClass} for="yt-input-title">
            Optional Title
          </label>
          <UIInput
            id="yt-input-title"
            value={ytTitle()}
            onInput={(event) => setYtTitle(event.currentTarget.value)}
            placeholder="Interview on microtonal composition"
          />

          <label class={fieldLabelClass} for="yt-input-tags">
            Tags (comma separated)
          </label>
          <UIInput
            id="yt-input-tags"
            value={ytTags()}
            onInput={(event) => setYtTags(event.currentTarget.value)}
            placeholder="youtube, interview"
          />

          <label class={fieldLabelClass} for="yt-input-transcript">
            Optional transcript excerpt
          </label>
          <UITextarea
            id="yt-input-transcript"
            value={ytTranscript()}
            onInput={(event) => setYtTranscript(event.currentTarget.value)}
            placeholder="Paste transcript text if already available"
          />

          <div
            class={css({
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "4",
            })}
          >
            <UIButton type="submit" variant="solid" disabled={isSubmitting()}>
              Ingest YouTube
            </UIButton>
          </div>
        </UICard>
      </div>

      <UICard>
        <div
          class={css({
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "3",
          })}
        >
          <h2 class={sectionTitleClass}>Recent Sources</h2>
          <UIBadge tone="violet">Convex Live</UIBadge>
        </div>

        <Show
          when={!recentSources.isLoading()}
          fallback={<p class={helperClass}>Loading sources…</p>}
        >
          <div class={sourceListClass}>
            <For each={recentSources.data() ?? []}>
              {(source: RecentSourceRow) => (
                <UICard class={css({ bg: "rgba(13, 6, 32, 0.38)", p: "4" })}>
                  <div
                    class={css({
                      display: "flex",
                      gap: "2",
                      marginBottom: "2",
                    })}
                  >
                    <UIBadge tone="cream">{source.type}</UIBadge>
                    <UIBadge tone="gold">{source.status}</UIBadge>
                  </div>

                  <h3 class={css({ fontSize: "lg", marginBottom: "1" })}>
                    {source.title ?? "Untitled source"}
                  </h3>
                  <p
                    class={css({
                      color: "rgba(245, 240, 232, 0.58)",
                      fontFamily: "mono",
                      fontSize: "xs",
                    })}
                  >
                    Updated {formatTimestamp(source.updatedAt)}
                  </p>

                  <Show when={source.canonicalUrl}>
                    <div
                      class={css({
                        display: "flex",
                        gap: "2",
                        marginTop: "3",
                      })}
                    >
                      <a
                        href={source.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        class={css({
                          color: "zodiac.gold",
                          fontFamily: "mono",
                          fontSize: "xs",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          textDecoration: "none",
                        })}
                      >
                        Open
                      </a>
                    </div>
                  </Show>
                </UICard>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
