import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, createResource, For, Show } from "solid-js";
import { css, cx } from "../../styled-system/css";
import {
  EssayCard,
  EssayDateBadge,
  essayDisplayTitleClass,
  essayHeroClass,
  essayMetaClass,
} from "../components/essay-card";
import {
  backLink,
  collapsedNoticeClass,
  Markdown,
  metaLabelClass,
  pageClass,
  sectionTitleClass,
  UIBadge,
  UICard,
  UIList,
  UINotice,
} from "../components/ui";
import { essayLibrary, getEssayBySlug } from "../lib/essays";

const titleClass = css({ mt: "4" });

const dekClass = css({
  color: "zodiac.cream/74",
  fontFamily: "display",
  fontSize: { base: "md", md: "lg" },
  lineHeight: "prose",
  maxW: "reading",
  mt: "4",
});

const articleCard = css({
  px: { base: "5", md: "8" },
  py: { base: "6", md: "8" },
});

const articleBody = css({
  maxW: "reading",
  marginInline: "auto",
});

const articleHeader = css({
  display: "grid",
  gap: "4",
  mb: "8",
});

const relatedGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    lg: "repeat(3, minmax(0, 1fr))",
  },
});

// Lets each card stretch to its grid row's height.
const relatedItem = css({ display: "grid" });

export function EssayDetailPage() {
  const params = useParams({ from: "/essays/$essaySlug" });
  const [essayResult] = createResource(
    () => params().essaySlug,
    async (slug) => {
      try {
        return { entry: await getEssayBySlug(slug), failed: false };
      } catch (error) {
        console.error("Essay body failed to load:", error);
        return { entry: null, failed: true };
      }
    },
  );
  // Per-request rather than a shared signal: a request that fails after
  // navigation started the next one can no longer paint its error over it.
  const essay = () => essayResult()?.entry ?? null;
  const loadFailed = () => essayResult()?.failed ?? false;

  createEffect(() => {
    if (essayResult.loading) return;
    const e = essay();
    document.title = e
      ? `${e.title} — Frequency Music`
      : loadFailed()
        ? "Essay unavailable — Frequency Music"
        : "Essay not found — Frequency Music";
  });
  const related = () =>
    essayLibrary
      .filter((entry) => entry.slug !== params().essaySlug)
      .slice(0, 3);

  return (
    <section class={pageClass}>
      <div>
        <Link to="/essays" class={backLink}>
          <span aria-hidden="true">&larr;</span> Essays
        </Link>
      </div>

      <UINotice
        class={
          essayResult.loading || !essay() ? undefined : collapsedNoticeClass
        }
        status={essayResult.loading ? "Loading essay..." : null}
        error={
          essayResult.loading || essay()
            ? null
            : loadFailed()
              ? "Could not load this essay. Check your connection and try again."
              : "Essay not found."
        }
      />

      <Show when={!essayResult.loading}>
        <Show when={essay()}>
          {(entry) => (
            <>
              <UICard class={essayHeroClass}>
                <div class={essayMetaClass}>
                  <EssayDateBadge essay={entry()} />
                  <UIBadge tone="cream">
                    {entry().readTimeMinutes} min read
                  </UIBadge>
                  <UIBadge tone="cream">
                    {entry().wordCount.toLocaleString()} words
                  </UIBadge>
                </div>
                <h1 class={cx(essayDisplayTitleClass, titleClass)}>
                  {entry().title}
                </h1>
                <p class={dekClass}>{entry().excerpt}</p>
              </UICard>

              <UICard class={articleCard}>
                <div class={articleBody}>
                  <div class={articleHeader}>
                    <div class={metaLabelClass}>Essay text</div>
                  </div>
                  <Markdown content={entry().body} />
                </div>
              </UICard>

              <Show when={related().length > 0}>
                <UICard>
                  <h2 class={sectionTitleClass}>Continue Reading</h2>
                  <UIList class={relatedGrid}>
                    <For each={related()}>
                      {(nextEssay) => (
                        <li class={relatedItem}>
                          <EssayCard essay={nextEssay} />
                        </li>
                      )}
                    </For>
                  </UIList>
                </UICard>
              </Show>
            </>
          )}
        </Show>
      </Show>
    </section>
  );
}
