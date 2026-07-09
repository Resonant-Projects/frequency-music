import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, For, Show } from "solid-js";
import { css } from "../../styled-system/css";
import {
  Markdown,
  UIBadge,
  UICard,
  backLink,
  pageClass,
  sectionTitleClass,
} from "../components/ui";
import { essayLibrary, getEssayBySlug } from "../lib/essays";

const heroCard = css({
  position: "relative",
  overflow: "hidden",
  bg: "linear-gradient(135deg, rgba(200, 168, 75, 0.16), rgba(13, 6, 32, 0.88) 58%)",
  _before: {
    content: '""',
    position: "absolute",
    inset: "auto -10% -30% auto",
    width: "18rem",
    height: "18rem",
    borderRadius: "full",
    background:
      "radial-gradient(circle, rgba(200, 168, 75, 0.22), rgba(200, 168, 75, 0) 68%)",
    filter: "blur(14px)",
    pointerEvents: "none",
  },
});

const titleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "44px", md: "56px" },
  fontWeight: "normal",
  lineHeight: "0.96",
  letterSpacing: "-0.015em",
  mt: "4",
});

const dekClass = css({
  color: "rgba(245, 240, 232, 0.74)",
  fontFamily: "display",
  fontSize: { base: "md", md: "lg" },
  lineHeight: "1.8",
  maxW: "44rem",
  mt: "4",
});

const articleCard = css({
  px: { base: "5", md: "8" },
  py: { base: "6", md: "8" },
});

const articleBody = css({
  maxW: "48rem",
  marginInline: "auto",
});

const articleHeader = css({
  display: "grid",
  gap: "4",
  mb: "8",
});

const articleLabel = css({
  color: "rgba(245, 240, 232, 0.58)",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
});

const relatedGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: { base: "1fr", lg: "repeat(3, minmax(0, 1fr))" },
});

const relatedLink = css({
  display: "grid",
  alignContent: "start",
  gap: "8px",
  textDecoration: "none",
  minHeight: "12rem",
  bg: "rgba(13, 6, 32, 0.92)",
  backdropFilter: "blur(8px)",
  borderColor: "rgba(200, 168, 75, 0.22)",
  borderRadius: "l3",
  borderWidth: "1px",
  color: "zodiac.cream",
  p: "16px 18px",
  transition:
    "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
  _hover: {
    transform: "translateY(-3px)",
    borderColor: "rgba(200, 168, 75, 0.48)",
    boxShadow: "0 22px 48px rgba(0, 0, 0, 0.24)",
  },
});

const relatedTitle = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: "xl",
  fontWeight: "normal",
  lineHeight: "1.2",
});

const relatedExcerpt = css({
  color: "rgba(245, 240, 232, 0.62)",
  lineHeight: "1.65",
});

export function EssayDetailPage() {
  const params = useParams({ from: "/essays/$essaySlug" });
  const essay = () => getEssayBySlug(params().essaySlug);

  createEffect(() => {
    const e = essay();
    if (e) document.title = `${e.title} — Frequency Music`;
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

      <Show
        when={essay()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>Essay not found.</p>
          </UICard>
        }
      >
        {(entry) => (
          <>
            <UICard glass class={heroCard}>
              <div class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
                <UIBadge tone="gold">
                  {entry().dateLabel ?? "Research essay"}
                </UIBadge>
                <UIBadge tone="cream">
                  {entry().readTimeMinutes} min read
                </UIBadge>
                <UIBadge tone="violet">
                  {entry().wordCount.toLocaleString()} words
                </UIBadge>
              </div>
              <h1 class={titleClass}>{entry().title}</h1>
              <p class={dekClass}>{entry().excerpt}</p>
            </UICard>

            <UICard class={articleCard}>
              <div class={articleBody}>
                <div class={articleHeader}>
                  <div class={articleLabel}>Essay text</div>
                </div>
                <Markdown content={entry().body} />
              </div>
            </UICard>

            <Show when={related().length > 0}>
              <UICard>
                <h2 class={sectionTitleClass}>Continue Reading</h2>
                <div class={relatedGrid}>
                  <For each={related()}>
                    {(nextEssay) => (
                      <Link
                        to="/essays/$essaySlug"
                        params={{ essaySlug: nextEssay.slug }}
                        class={relatedLink}
                      >
                        <div
                          class={css({
                            display: "flex",
                            gap: "2",
                            flexWrap: "wrap",
                          })}
                        >
                          <UIBadge tone="gold">
                            {nextEssay.dateLabel ?? "Research essay"}
                          </UIBadge>
                          <UIBadge tone="cream">
                            {nextEssay.readTimeMinutes} min
                          </UIBadge>
                        </div>
                        <h2 class={relatedTitle}>{nextEssay.title}</h2>
                        <p class={relatedExcerpt}>{nextEssay.excerpt}</p>
                      </Link>
                    )}
                  </For>
                </div>
              </UICard>
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}
