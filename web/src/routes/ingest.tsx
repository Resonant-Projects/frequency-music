import { createSignal, For, Show } from "solid-js";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard, UIInput, UITextarea } from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import { convexApi } from "../integrations/convex/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  createAction,
  createMutation,
  createQueryWithStatus,
} from "../integrations/convex";

const pageClass = css({
  display: "grid",
  gap: "6",
  p: { base: "4", md: "6" },
});

const twoColClass = css({
  display: "grid",
  gap: "4",
  gridTemplateColumns: { base: "1fr", lg: "1fr 1fr" },
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
  const [urlTitle, setUrlTitle] = createSignal("");
  const [urlValue, setUrlValue] = createSignal("");
  const [urlRawText, setUrlRawText] = createSignal("");
  const [urlTags, setUrlTags] = createSignal("");

  const [ytTitle, setYtTitle] = createSignal("");
  const [ytValue, setYtValue] = createSignal("");
  const [ytTranscript, setYtTranscript] = createSignal("");
  const [ytTags, setYtTags] = createSignal("");

  const [notice, setNotice] = createSignal<string | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const createFromUrlInput = createMutation(convexApi.sources.createFromUrlInput);
  const createFromYouTubeInput = createMutation(
    convexApi.sources.createFromYouTubeInput,
  );
  const runExtraction = createAction(convexApi.extract.extractSource);

  const recentSources = createQueryWithStatus(convexApi.sources.listRecent, () => ({
    limit: 14,
  }));

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
        result.created
          ? "URL source ingested into private inbox."
          : "URL updated from latest ingest payload.",
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
        result.created
          ? "YouTube source ingested into private inbox."
          : "YouTube source updated from latest ingest payload.",
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

  async function triggerExtraction(sourceId: string) {
    setNotice(null);
    try {
      await runExtraction(withDevBypassSecret({ sourceId: sourceId as Id<"sources"> }));
      setNotice("Extraction dispatched.");
    } catch (error) {
      setNotice(`Extraction failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={sectionTitleClass}>Ingest Console</h1>
        <p class={helperClass}>
          Add research inputs directly into Convex. URL and YouTube entries are
          dedupe-safe and land in the private inbox pipeline.
        </p>
        <Show when={notice()}>
          {(message) => (
            <p class={css({ color: "zodiac.cream", marginTop: "3" })}>{message()}</p>
          )}
        </Show>
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

          <div class={css({ display: "flex", justifyContent: "flex-end", marginTop: "4" })}>
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

          <div class={css({ display: "flex", justifyContent: "flex-end", marginTop: "4" })}>
            <UIButton type="submit" variant="solid" disabled={isSubmitting()}>
              Ingest YouTube
            </UIButton>
          </div>
        </UICard>
      </div>

      <UICard>
        <div class={css({ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: "3" })}>
          <h2 class={sectionTitleClass}>Recent Sources</h2>
          <UIBadge tone="violet">Convex Live</UIBadge>
        </div>

        <Show when={!recentSources.isLoading()} fallback={<p class={helperClass}>Loading sources…</p>}>
          <div class={sourceListClass}>
            <For each={recentSources.data() ?? []}>
              {(source: any) => (
                <UICard class={css({ bg: "rgba(13, 6, 32, 0.38)", p: "4" })}>
                  <div class={css({ display: "flex", gap: "2", marginBottom: "2" })}>
                    <UIBadge tone="cream">{source.type}</UIBadge>
                    <UIBadge tone="gold">{source.status}</UIBadge>
                  </div>

                  <h3 class={css({ fontSize: "lg", marginBottom: "1" })}>
                    {source.title ?? "Untitled source"}
                  </h3>
                  <p class={css({ color: "rgba(245, 240, 232, 0.58)", fontFamily: "mono", fontSize: "xs" })}>
                    Updated {formatTimestamp(source.updatedAt)}
                  </p>

                  <div class={css({ display: "flex", gap: "2", marginTop: "3" })}>
                    <UIButton
                      variant="outline"
                      disabled={source.status !== "text_ready"}
                      onClick={() => triggerExtraction(String(source._id))}
                    >
                      Run Extraction
                    </UIButton>
                    <Show when={source.canonicalUrl}>
                      <a
                        href={source.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        class={css({ color: "zodiac.gold", fontFamily: "mono", fontSize: "xs", letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", alignSelf: "center" })}
                      >
                        Open
                      </a>
                    </Show>
                  </div>
                </UICard>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
