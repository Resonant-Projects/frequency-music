import { Link } from "@tanstack/solid-router";
import { For, onMount } from "solid-js";
import { css } from "../../styled-system/css";
import { UIBadge, UICard, pageClass, sectionTitleClass } from "../components/ui";
import { essayLibrary } from "../lib/essays";

const heroCard = css({
  position: "relative",
  overflow: "hidden",
  p: "0",
  bg: "linear-gradient(135deg, rgba(200, 168, 75, 0.16), rgba(13, 6, 32, 0.88) 58%)",
  _before: {
    content: '""',
    position: "absolute",
    inset: "auto -10% -30% auto",
    width: "18rem",
    height: "18rem",
    borderRadius: "full",
    background: "radial-gradient(circle, rgba(200, 168, 75, 0.22), rgba(200, 168, 75, 0) 68%)",
    filter: "blur(14px)",
    pointerEvents: "none",
  },
});

const heroLayout = css({
  display: "grid",
  gridTemplateColumns: {
    base: "1fr",
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
  borderTop: { base: "1px solid rgba(200, 168, 75, 0.10)", lg: "none" },
  borderLeft: { base: "none", lg: "1px solid rgba(200, 168, 75, 0.10)" },
  display: "grid",
  alignContent: "start",
  gap: "0",
  minHeight: { base: "auto", lg: "100%" },
});

const eyebrow = css({
  color: "rgba(200, 168, 75, 0.58)",
  fontFamily: "mono",
  fontSize: "9px",
  letterSpacing: "0.4em",
  textTransform: "uppercase",
  mb: "12px",
});

const heroTitle = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "44px", md: "56px" },
  fontWeight: "normal",
  lineHeight: "0.96",
  letterSpacing: "-0.015em",
  maxW: "12ch",
  m: "0",
});

const heroBody = css({
  color: "rgba(245, 240, 232, 0.66)",
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

const featuredLink = css({
  display: "grid",
  gap: "12px",
  textDecoration: "none",
  borderColor: "rgba(245, 240, 232, 0.14)",
  borderWidth: "1px",
  borderRadius: "l3",
  p: { base: "18px", md: "22px 26px" },
  bg: "rgba(13, 6, 32, 0.45)",
  transition: "transform 0.2s ease, border-color 0.2s ease",
  alignSelf: "start",
  _hover: {
    transform: "translateY(-2px)",
    borderColor: "rgba(200, 168, 75, 0.45)",
  },
});

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
  color: "rgba(245, 240, 232, 0.62)",
  fontSize: "13px",
  fontWeight: "300",
  lineHeight: "1.65",
  m: "0",
});

const archiveGrid = css({
  display: "grid",
  gap: { base: "4", md: "5", xl: "6" },
  gridTemplateColumns: {
    base: "1fr",
    md: "repeat(2, minmax(0, 1fr))",
    xl: "repeat(3, minmax(0, 1fr))",
  },
});

const essayCard = css({
  position: "relative",
  overflow: "hidden",
  display: "grid",
  alignContent: "start",
  gap: "8px",
  textDecoration: "none",
  minHeight: { base: "auto", md: "13.5rem" },
  bg: "rgba(13, 6, 32, 0.92)",
  transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
  backdropFilter: "blur(8px)",
  borderColor: "rgba(200, 168, 75, 0.22)",
  borderRadius: "l3",
  borderWidth: "1px",
  color: "zodiac.cream",
  p: "16px 18px",
  _hover: {
    transform: "translateY(-3px)",
    borderColor: "rgba(200, 168, 75, 0.48)",
    boxShadow: "0 22px 48px rgba(0, 0, 0, 0.24)",
  },
});

const essayMeta = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
});

const essayTitle = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "22px", md: "24px" },
  fontWeight: "normal",
  lineHeight: "1.08",
  letterSpacing: "-0.01em",
  m: "0",
});

const essayExcerpt = css({
  color: "rgba(245, 240, 232, 0.68)",
  fontSize: "13px",
  fontWeight: "300",
  lineHeight: "1.65",
  m: "0",
});

const essayFooter = css({
  color: "rgba(245, 240, 232, 0.58)",
  fontFamily: "mono",
  fontSize: "9px",
  letterSpacing: "0.26em",
  textTransform: "uppercase",
  mt: "12px",
});

export function EssaysPage() {
  onMount(() => {
    document.title = "Essays — Frequency Music";
  });

  const [featured, ...archive] = essayLibrary;

  return (
    <section class={pageClass}>
      <UICard glass class={heroCard}>
        <div class={heroLayout}>
          <div class={heroLead}>
            <div class={eyebrow}>Written Essays</div>
            <h1 class={heroTitle}>Essays</h1>
            <p class={heroBody}>
              These essays take the project&apos;s raw material, papers, and notes and turn them
              into arguments worth reading end to end. The latest pieces lean into mathematical
              music theory, tuning, rhythm, AI, and the physical structure of sound.
            </p>

            <div class={statRow}>
              <UIBadge tone="gold">{essayLibrary.length} essays</UIBadge>
              <UIBadge tone="cream">
                {essayLibrary.reduce((sum, essay) => sum + essay.wordCount, 0).toLocaleString()}{" "}
                words
              </UIBadge>
              <UIBadge tone="violet">Frequency Music archive</UIBadge>
            </div>
          </div>

          {featured ? (
            <div class={heroFeaturedZone}>
              <Link
                to="/essays/$essaySlug"
                params={{ essaySlug: featured.slug }}
                class={featuredLink}
              >
                <div class={eyebrow}>Latest dispatch</div>
                <div class={essayMeta}>
                  <UIBadge tone="gold">{featured.dateLabel ?? "Research essay"}</UIBadge>
                  <UIBadge tone="cream">{featured.readTimeMinutes} min read</UIBadge>
                </div>
                <h2 class={featuredTitle}>{featured.title}</h2>
                <p class={featuredExcerpt}>{featured.excerpt}</p>
              </Link>
            </div>
          ) : null}
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Archive</h2>
        <div class={archiveGrid}>
          <For each={archive.length > 0 ? archive : featured ? [featured] : []}>
            {(essay) => (
              <Link to="/essays/$essaySlug" params={{ essaySlug: essay.slug }} class={essayCard}>
                <div class={essayMeta}>
                  <UIBadge tone="gold">{essay.dateLabel ?? "Research essay"}</UIBadge>
                  <UIBadge tone="cream">{essay.readTimeMinutes} min</UIBadge>
                </div>
                <h2 class={essayTitle}>{essay.title}</h2>
                <p class={essayExcerpt}>{essay.excerpt}</p>
                <div class={essayFooter}>Read essay</div>
              </Link>
            )}
          </For>
        </div>
      </UICard>
    </section>
  );
}
