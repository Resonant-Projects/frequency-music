import { createSignal, createUniqueId, For, onMount, Show } from "solid-js";
import { css, cx } from "../../styled-system/css";
import {
  EssayCard,
  EssayDateBadge,
  EssayStretchedLink,
  essayCardLiftClass,
  essayDisplayTitleClass,
  essayHeroClass,
  essayMetaClass,
} from "../components/essay-card";
import {
  UIBadge,
  UIButton,
  UICard,
  eyebrowClass,
  pageClass,
  sectionTitleClass,
} from "../components/ui";
import { essayLibrary } from "../lib/essays";

const ARCHIVE_PAGE_SIZE = 24;

const heroCard = css({ p: "0" });

const heroLayout = css({
  display: "grid",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    lg: "minmax(0, 1.08fr) minmax(360px, 0.92fr)",
  },
  alignItems: "start",
});

const heroLead = css({
  p: { base: "5", md: "6" },
  display: "grid",
  alignContent: "start",
});

const heroFeaturedZone = css({
  p: { base: "5", md: "6" },
  borderTopWidth: { base: "1px", lg: "0" },
  borderTopStyle: "solid",
  borderTopColor: "zodiac.gold/10",
  borderLeftWidth: { base: "0", lg: "1px" },
  borderLeftStyle: "solid",
  borderLeftColor: "zodiac.gold/10",
  display: "grid",
  alignContent: "start",
  gap: "0",
  minHeight: { base: "auto", lg: "100%" },
});

const heroTitle = css({ maxW: "12ch" });

const heroBody = css({
  color: "zodiac.cream/66",
  fontFamily: "display",
  fontSize: { base: "16px", md: "18px" },
  fontWeight: "300",
  lineHeight: "1.75",
  maxW: "36rem",
  mt: "16px",
  mb: "0",
});

const statRow = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  mt: "20px",
});

const featuredCard = css({
  position: "relative",
  display: "grid",
  gap: "12px",
  borderColor: "zodiac.cream/14",
  borderWidth: "1px",
  borderRadius: "l3",
  p: { base: "18px", md: "22px 26px" },
  bg: "zodiac.void/45",
  alignSelf: "start",
});

const featuredEyebrow = css({ mb: "12px" });

const featuredTitle = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "30px", md: "36px" },
  fontWeight: "normal",
  lineHeight: "1.08",
  letterSpacing: "-0.012em",
  m: "0",
});

const featuredExcerpt = css({
  color: "zodiac.cream/66",
  fontSize: "14px",
  fontWeight: "400",
  lineHeight: "1.65",
  m: "0",
});

const archiveGrid = css({
  display: "grid",
  gap: { base: "4", md: "5", xl: "6" },
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "repeat(2, minmax(0, 1fr))",
    xl: "repeat(3, minmax(0, 1fr))",
  },
  listStyle: "none",
  m: "0",
  p: "0",
});

// Lets each card stretch to its grid row's height.
const archiveItem = css({ display: "grid" });

const showMoreRow = css({
  display: "flex",
  justifyContent: "center",
  mt: "5",
});

export function EssaysPage() {
  onMount(() => {
    document.title = "Essays — Frequency Music";
  });

  // The newest essay is the hero's featured dispatch, so the archive starts
  // with the one after it and never repeats it.
  const [featured, ...archiveList] = essayLibrary;
  const featuredTitleId = createUniqueId();
  const [visibleCount, setVisibleCount] = createSignal(ARCHIVE_PAGE_SIZE);
  const visibleArchive = () => archiveList.slice(0, visibleCount());
  let archiveListRef: HTMLUListElement | undefined;

  function showMore() {
    const firstRevealed = visibleCount();
    setVisibleCount(firstRevealed + ARCHIVE_PAGE_SIZE);
    // The button unmounts once the last page is revealed, so focus always
    // moves on to the first newly revealed card.
    queueMicrotask(() => {
      archiveListRef?.children[firstRevealed]?.querySelector("a")?.focus();
    });
  }

  return (
    <section class={pageClass}>
      <UICard class={cx(essayHeroClass, heroCard)}>
        <div class={heroLayout}>
          <div class={heroLead}>
            <h1 class={cx(essayDisplayTitleClass, heroTitle)}>Essays</h1>
            <p class={heroBody}>
              These essays take the project&apos;s raw material, papers, and
              notes and turn them into arguments worth reading end to end. The
              latest pieces lean into mathematical music theory, tuning, rhythm,
              AI, and the physical structure of sound.
            </p>

            <div class={statRow}>
              <UIBadge tone="gold">{essayLibrary.length} essays</UIBadge>
              <UIBadge tone="cream">
                {essayLibrary
                  .reduce((sum, essay) => sum + essay.wordCount, 0)
                  .toLocaleString()}{" "}
                words
              </UIBadge>
              <UIBadge tone="cream">Frequency Music archive</UIBadge>
            </div>
          </div>

          {featured ? (
            <div class={heroFeaturedZone}>
              <article class={cx(featuredCard, essayCardLiftClass)}>
                <div class={cx(eyebrowClass, featuredEyebrow)}>
                  Latest dispatch
                </div>
                <div class={essayMetaClass}>
                  <EssayDateBadge essay={featured} />
                  <UIBadge tone="cream">
                    {featured.readTimeMinutes} min read
                  </UIBadge>
                </div>
                <h2 id={featuredTitleId} class={featuredTitle}>
                  {featured.title}
                </h2>
                <p class={featuredExcerpt}>{featured.excerpt}</p>
                <EssayStretchedLink
                  slug={featured.slug}
                  labelledBy={featuredTitleId}
                />
              </article>
            </div>
          ) : null}
        </div>
      </UICard>

      <Show when={archiveList.length > 0}>
        <UICard>
          <h2 class={sectionTitleClass}>Archive</h2>
          <ul
            role="list"
            class={archiveGrid}
            ref={(element) => {
              archiveListRef = element;
            }}
          >
            <For each={visibleArchive()}>
              {(essay) => (
                <li class={archiveItem}>
                  <EssayCard essay={essay} footer />
                </li>
              )}
            </For>
          </ul>
          <Show when={visibleCount() < archiveList.length}>
            <div class={showMoreRow}>
              <UIButton variant="outline" onClick={showMore}>
                Show more
              </UIButton>
            </div>
          </Show>
        </UICard>
      </Show>
    </section>
  );
}
