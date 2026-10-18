import { createSignal, Index, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  badgeRowClass,
  DateTime,
  fieldLabelClass,
  focusRingClass,
  formActionsClass,
  helperClass,
  inlineActionLink,
  metaLine,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UIList,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import {
  createAction,
  createMutation,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";
import {
  PDF_CONTENT_TYPE,
  pdfUploadProblem,
} from "../../../convex/shared/pdfCapture";

// Every grid column is `minmax(0, 1fr)`: a bare `1fr` keeps an `auto`
// minimum, so one nowrap feed URL would widen the page past a phone viewport.
const twoColClass = css({
  display: "grid",
  gap: "4",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    lg: "repeat(2, minmax(0, 1fr))",
  },
});

const sourceListClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "repeat(2, minmax(0, 1fr))",
  },
});

/** A section heading with its trailing control or badge. */
const headerRowClass = cx(
  badgeRowClass,
  css({ justifyContent: "space-between" }),
);

const sectionHeaderClass = cx(headerRowClass, css({ mb: "3" }));

/** The submit row closing the URL and YouTube forms. */
const formFooterClass = cx(formActionsClass, css({ mt: "4" }));

const insetCardClass = css({ bg: "zodiac.void/38" });

const feedListClass = css({
  display: "grid",
  gap: "2",
  gridTemplateColumns: "minmax(0, 1fr)",
  maxH: "96",
  overflowY: "auto",
  overflowX: "hidden",
});

const feedRowClass = css({
  alignItems: "center",
  borderColor: "zodiac.gold/24",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "flex",
  gap: "2",
  justifyContent: "space-between",
  minW: "0",
  p: "3",
});

const feedTextClass = css({ flex: "1", minW: "0", overflow: "hidden" });

const feedMetaClass = cx(
  metaLine,
  css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
);

const feedToggleClass = css({ flexShrink: 0 });

const sourceCardClass = css({ bg: "zodiac.void/38", minW: "0", p: "4" });

const sourceTitleClass = cx(sectionTitleClass, css({ mb: "1" }));

const sourceBadgesClass = cx(badgeRowClass, css({ mb: "2" }));

const sourceLinkRowClass = cx(badgeRowClass, css({ mt: "3" }));

export function IngestPage() {
  onMount(() => {
    document.title = "Ingest — Frequency Music";
  });

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

  const [pdfFile, setPdfFile] = createSignal<File | null>(null);
  const [pdfUrl, setPdfUrl] = createSignal("");
  const [pdfTitle, setPdfTitle] = createSignal("");
  const [pdfTags, setPdfTags] = createSignal("");
  let pdfFileInput: HTMLInputElement | undefined;

  const [feedName, setFeedName] = createSignal("");
  const [feedUrl, setFeedUrl] = createSignal("");
  const [feedType, setFeedType] = createSignal("rss");

  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const [isAddingFeed, setIsAddingFeed] = createSignal(false);
  const [isIngestingUrl, setIsIngestingUrl] = createSignal(false);
  const [isIngestingYouTube, setIsIngestingYouTube] = createSignal(false);
  const [isIngestingPdf, setIsIngestingPdf] = createSignal(false);

  const createFromUrlInput = createAction(api.sources.createFromUrlAndQueue);
  const createFromYouTubeInput = createAction(
    api.sources.createFromYouTubeAndQueue,
  );
  const generatePdfUploadUrl = createMutation(
    api.pdfCapture.generatePdfUploadUrl,
  );
  const createFromPdfUpload = createMutation(
    api.pdfCapture.createFromPdfUpload,
  );
  const createFromPdfUrl = createMutation(api.pdfCapture.createFromPdfUrl);
  const createFeed = createMutation(api.admin.createFeed);
  const setFeedEnabled = createMutation(api.admin.setFeedEnabled);
  const pollFeedsNow = createAction(api.admin.pollFeedsNow);
  const feeds = createQueryWithStatus(api.admin.listFeeds);

  const recentSources = createQueryWithStatus(api.sources.listRecent, () => ({
    limit: 14,
  }));

  async function submitUrl(event: SubmitEvent) {
    event.preventDefault();
    if (isIngestingUrl()) return;

    if (!urlValue().trim()) {
      setNotice(null);
      setNoticeError("URL is required.");
      return;
    }

    setIsIngestingUrl(true);
    setNotice(null);
    setNoticeError(null);

    try {
      const result = await createFromUrlInput({
        url: urlValue().trim(),
        title: urlTitle().trim() || undefined,
        rawText: urlRawText().trim() || undefined,
        tags: urlTags()
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

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
      setNoticeError(`URL ingest failed: ${describeError(error)}`);
    } finally {
      setIsIngestingUrl(false);
    }
  }

  async function submitYouTube(event: SubmitEvent) {
    event.preventDefault();
    if (isIngestingYouTube()) return;

    if (!ytValue().trim()) {
      setNotice(null);
      setNoticeError("YouTube URL is required.");
      return;
    }

    setIsIngestingYouTube(true);
    setNotice(null);
    setNoticeError(null);

    try {
      const result = await createFromYouTubeInput({
        url: ytValue().trim(),
        title: ytTitle().trim() || undefined,
        transcript: ytTranscript().trim() || undefined,
        tags: ytTags()
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

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
      setNoticeError(`YouTube ingest failed: ${describeError(error)}`);
    } finally {
      setIsIngestingYouTube(false);
    }
  }

  async function submitPdf(event: SubmitEvent) {
    event.preventDefault();
    if (isIngestingPdf()) return;

    const file = pdfFile();
    const url = pdfUrl().trim();
    const problem =
      file && url
        ? "Choose a PDF file or a PDF URL, not both."
        : !file && !url
          ? "A PDF file or a PDF URL is required."
          : file
            ? pdfUploadProblem({
                size: file.size,
                contentType: file.type || undefined,
              })
            : null;
    if (problem) {
      setNotice(null);
      setNoticeError(problem);
      return;
    }

    setIsIngestingPdf(true);
    setNotice(null);
    setNoticeError(null);

    try {
      const title = pdfTitle().trim() || undefined;
      const tags = pdfTags()
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      let result: { created: boolean };
      if (file) {
        const uploadUrl = await generatePdfUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": PDF_CONTENT_TYPE },
          body: file,
        });
        if (!response.ok)
          throw new Error(`the upload returned HTTP ${response.status}`);
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        result = await createFromPdfUpload({
          storageId,
          fileName: file.name,
          title,
          tags,
        });
      } else {
        result = await createFromPdfUrl({ url, title, tags });
      }

      setNotice(
        result.created
          ? "PDF source ingested into private inbox. Lab Firecrawl is reading its text."
          : "This PDF is already a source; nothing new was queued.",
      );
      setPdfFile(null);
      if (pdfFileInput) pdfFileInput.value = "";
      setPdfUrl("");
      setPdfTitle("");
      setPdfTags("");
    } catch (error) {
      setNoticeError(`PDF ingest failed: ${describeError(error)}`);
    } finally {
      setIsIngestingPdf(false);
    }
  }

  async function submitFeed(event: SubmitEvent) {
    event.preventDefault();
    if (isAddingFeed()) return;

    if (!feedName().trim() || !feedUrl().trim()) {
      setNotice(null);
      setNoticeError("Feed name and URL are required.");
      return;
    }

    setIsAddingFeed(true);
    setNotice(null);
    setNoticeError(null);

    try {
      await createFeed({
        name: feedName().trim(),
        url: feedUrl().trim(),
        type: feedType() as "rss" | "podcast" | "youtube",
      });
      setFeedName("");
      setFeedUrl("");
      setNotice("Feed created.");
    } catch (error) {
      setNoticeError(`Feed creation failed: ${describeError(error)}`);
    } finally {
      setIsAddingFeed(false);
    }
  }

  async function toggleFeed(id: string, enabled: boolean) {
    setNotice(null);
    setNoticeError(null);
    try {
      await setFeedEnabled({ id: id as Id<"feeds">, enabled: !enabled });
      setNotice("Feed state updated.");
    } catch (error) {
      setNoticeError(`Failed to toggle feed: ${describeError(error)}`);
    }
  }

  async function runPoll() {
    setNotice(null);
    setNoticeError(null);
    try {
      await pollFeedsNow({});
      setNotice("Feed poll started.");
    } catch (error) {
      setNoticeError(`Feed poll failed: ${describeError(error)}`);
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
        <UINotice
          class={css({ marginTop: "3" })}
          status={notice()}
          error={noticeError()}
        />
      </UICard>

      <UICard>
        <div class={sectionHeaderClass}>
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
            onSubmit={submitFeed}
            aria-busy={isAddingFeed()}
            class={insetCardClass}
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

            <div class={cx(formActionsClass, css({ mt: "3" }))}>
              <UIButton
                type="submit"
                variant="solid"
                aria-busy={isAddingFeed()}
              >
                Add Feed
              </UIButton>
            </div>
          </UICard>

          <UICard class={insetCardClass}>
            <div class={cx(headerRowClass, css({ mb: "2" }))}>
              <h3 class={sectionTitleClass}>Feed List</h3>
              <UIBadge tone="violet">
                {feeds.data()?.length ?? "—"} feeds
              </UIBadge>
            </div>
            <UINotice
              status={feeds.isLoading() ? "Loading feeds…" : null}
              error={
                feeds.error()
                  ? `Unable to load feeds: ${feeds.error()?.message}`
                  : null
              }
            />
            <UIList
              tabIndex={0}
              aria-label="Feed list"
              class={cx(feedListClass, focusRingClass, "zodiac-scroll")}
            >
              {/* <Index>, not <For>: each live update hands back fresh objects,
                  and <For> would rebuild every row, unmounting the toggle that
                  was just pressed and dropping focus to <body>. */}
              <Index each={(feeds.data() ?? []) as FeedRow[]}>
                {(feed) => (
                  <li data-testid="ingest-feed-row" class={feedRowClass}>
                    <div class={feedTextClass}>
                      <p>{feed().name}</p>
                      <p class={feedMetaClass}>
                        {feed().type} · {feed().url}
                      </p>
                    </div>
                    <UIButton
                      variant="outline"
                      class={feedToggleClass}
                      aria-label={`${feed().enabled ? "Disable" : "Enable"} feed ${feed().name}`}
                      onClick={() =>
                        toggleFeed(String(feed()._id), Boolean(feed().enabled))
                      }
                    >
                      {feed().enabled ? "Disable" : "Enable"}
                    </UIButton>
                  </li>
                )}
              </Index>
            </UIList>
          </UICard>
        </div>
      </UICard>

      <div class={twoColClass}>
        <UICard as="form" onSubmit={submitUrl} aria-busy={isIngestingUrl()}>
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

          <div class={formFooterClass}>
            <UIButton
              type="submit"
              variant="outline"
              aria-busy={isIngestingUrl()}
            >
              Ingest URL
            </UIButton>
          </div>
        </UICard>

        <UICard
          as="form"
          onSubmit={submitYouTube}
          aria-busy={isIngestingYouTube()}
        >
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

          <div class={formFooterClass}>
            <UIButton
              type="submit"
              variant="outline"
              aria-busy={isIngestingYouTube()}
            >
              Ingest YouTube
            </UIButton>
          </div>
        </UICard>

        <UICard as="form" onSubmit={submitPdf} aria-busy={isIngestingPdf()}>
          <h2 class={sectionTitleClass}>PDF Ingest</h2>

          <label class={fieldLabelClass} for="pdf-input-file">
            PDF file (25 MB at most)
          </label>
          <UIInput
            id="pdf-input-file"
            ref={pdfFileInput}
            type="file"
            accept={`${PDF_CONTENT_TYPE},.pdf`}
            onChange={(event) =>
              setPdfFile(event.currentTarget.files?.[0] ?? null)
            }
          />

          <label class={fieldLabelClass} for="pdf-input-url">
            Or a PDF URL
          </label>
          <UIInput
            id="pdf-input-url"
            value={pdfUrl()}
            onInput={(event) => setPdfUrl(event.currentTarget.value)}
            placeholder="https://example.org/paper.pdf"
          />

          <label class={fieldLabelClass} for="pdf-input-title">
            Optional Title
          </label>
          <UIInput
            id="pdf-input-title"
            value={pdfTitle()}
            onInput={(event) => setPdfTitle(event.currentTarget.value)}
            placeholder="Tuning, Timbre, Spectrum, Scale"
          />

          <label class={fieldLabelClass} for="pdf-input-tags">
            Tags (comma separated)
          </label>
          <UIInput
            id="pdf-input-tags"
            value={pdfTags()}
            onInput={(event) => setPdfTags(event.currentTarget.value)}
            placeholder="tuning, timbre"
          />

          <p class={helperClass}>
            Lab Firecrawl reads the text. Scanned PDFs need pasted text.
          </p>

          <div class={formFooterClass}>
            <UIButton
              type="submit"
              variant="outline"
              aria-busy={isIngestingPdf()}
            >
              Ingest PDF
            </UIButton>
          </div>
        </UICard>
      </div>

      <UICard>
        <div class={sectionHeaderClass}>
          <h2 class={sectionTitleClass}>Recent Sources</h2>
          <UIBadge tone="violet">Convex Live</UIBadge>
        </div>

        <UINotice
          class={helperClass}
          status={recentSources.isLoading() ? "Loading sources…" : null}
          error={
            recentSources.isError()
              ? `Unable to load recent sources: ${recentSources.error()?.message ?? "unknown error"}`
              : null
          }
        />
        <Show when={!recentSources.isLoading()}>
          <UIList class={sourceListClass}>
            <Index each={(recentSources.data() ?? []) as RecentSourceRow[]}>
              {(source) => (
                <UICard as="li" class={sourceCardClass}>
                  <div class={sourceBadgesClass}>
                    <UIBadge tone="cream">{source().type}</UIBadge>
                    <UIBadge tone="gold">{source().status}</UIBadge>
                  </div>

                  <h3 class={sourceTitleClass}>
                    {source().title ?? "Untitled source"}
                  </h3>
                  <p class={metaLine}>
                    Updated{" "}
                    <DateTime format="datetime" value={source().updatedAt} />
                  </p>

                  <Show when={source().canonicalUrl}>
                    {(href) => (
                      <div class={sourceLinkRowClass}>
                        <a
                          href={href()}
                          target="_blank"
                          rel="noreferrer"
                          class={inlineActionLink}
                        >
                          Open
                        </a>
                      </div>
                    )}
                  </Show>
                </UICard>
              )}
            </Index>
          </UIList>
        </Show>
      </UICard>
    </section>
  );
}
