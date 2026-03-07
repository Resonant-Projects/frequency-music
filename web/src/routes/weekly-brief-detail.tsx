import { Link, useParams } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { SolidMarkdown } from "solid-markdown";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard, pageClass } from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import { createAction, createQuery } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const goldDivider = css({
  border: "none",
  borderTop: "1px solid rgba(200, 168, 75, 0.22)",
  my: "6",
});

const backLink = css({
  color: "zodiac.gold",
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "mono",
  fontSize: "xs",
  gap: "1.5",
  letterSpacing: "0.14em",
  textDecoration: "none",
  textTransform: "uppercase",
  opacity: 0.7,
  _hover: { opacity: 1 },
});

const titleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: { base: "2xl", md: "3xl" },
  fontWeight: "normal",
  lineHeight: "1.3",
  mt: "3",
});

const sectionLabel = css({
  color: "zodiac.gold",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  mb: "3",
  textTransform: "uppercase",
});

const metaLine = css({
  color: "rgba(245, 240, 232, 0.4)",
  fontFamily: "mono",
  fontSize: "xs",
});

const markdownWrapper = css({
  color: "rgba(245, 240, 232, 0.78)",
  fontFamily: "display",
  fontSize: "md",
  lineHeight: "1.75",
  "& h1": {
    color: "zodiac.cream",
    fontFamily: "display",
    fontSize: "2xl",
    fontWeight: "normal",
    lineHeight: "1.3",
    mt: "6",
    mb: "3",
  },
  "& h2": {
    color: "zodiac.cream",
    fontFamily: "display",
    fontSize: "xl",
    fontWeight: "normal",
    lineHeight: "1.4",
    mt: "5",
    mb: "2",
  },
  "& h3": {
    color: "zodiac.gold",
    fontFamily: "display",
    fontSize: "lg",
    fontWeight: "normal",
    lineHeight: "1.4",
    mt: "4",
    mb: "2",
  },
  "& p": { mb: "3" },
  "& ul, & ol": { pl: "5", mb: "3" },
  "& li": { py: "0.5" },
  "& strong": { color: "zodiac.cream", fontWeight: "600" },
  "& em": { fontStyle: "italic" },
  "& code": {
    bg: "rgba(13, 6, 32, 0.5)",
    borderRadius: "sm",
    fontFamily: "mono",
    fontSize: "sm",
    px: "1.5",
    py: "0.5",
  },
  "& pre": {
    bg: "rgba(13, 6, 32, 0.5)",
    borderRadius: "l1",
    fontFamily: "mono",
    fontSize: "sm",
    lineHeight: "1.6",
    overflow: "auto",
    p: "3",
    mb: "3",
  },
  "& a": {
    color: "rgba(139, 92, 246, 0.8)",
    textDecoration: "underline",
    _hover: { color: "zodiac.violet" },
  },
  "& hr": {
    border: "none",
    borderTop: "1px solid rgba(200, 168, 75, 0.15)",
    my: "4",
  },
  "& blockquote": {
    borderLeft: "3px solid rgba(200, 168, 75, 0.3)",
    color: "rgba(245, 240, 232, 0.6)",
    fontStyle: "italic",
    ml: "0",
    pl: "4",
    mb: "3",
  },
});

function extractTitle(bodyMd: string): string {
  const match = bodyMd.match(/^#\s+(.+)/m);
  return match ? match[1] : "Weekly Brief";
}

export function WeeklyBriefDetailPage() {
  const params = useParams({ from: "/weekly-turns/$briefId" });

  const brief = createQuery(convexApi.weeklyBriefs.get, () => ({
    id: params().briefId as Id<"weeklyBriefs">,
  }));

  const publishToNotion = createAction(convexApi.weeklyBriefs.publishToNotion);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [publishing, setPublishing] = createSignal(false);

  async function handlePublish() {
    const b = brief();
    if (!b) return;
    setPublishing(true);
    setNotice(null);
    try {
      const result = await publishToNotion(
        withDevBypassSecret({ id: b._id as Id<"weeklyBriefs"> }),
      );
      setNotice(`Published to Notion: ${result.notionUrl ?? "success"}`);
    } catch (error) {
      setNotice(`Publish failed: ${String(error)}`);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section class={pageClass}>
      <div>
        <Link to="/weekly-turns" class={backLink}>
          <span aria-hidden="true">&larr;</span> Weekly Turns
        </Link>
      </div>

      <Show
        when={brief()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>Loading brief...</p>
          </UICard>
        }
      >
        {(b) => (
          <UICard>
            {/* Badges */}
            <div
              class={css({
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "2",
                mb: "2",
              })}
            >
              <UIBadge tone="gold">Week {b().weekOf}</UIBadge>
              <UIBadge tone="cream">{b().visibility}</UIBadge>
              <UIBadge tone="violet">
                {b().recommendedHypothesisIds.length} hypotheses
              </UIBadge>
              <UIBadge tone="violet">
                {b().recommendedRecipeIds.length} recipes
              </UIBadge>
              <UIBadge tone="violet">
                {b().sourceIds.length} sources
              </UIBadge>
            </div>

            {/* Title */}
            <h1 class={titleClass}>{extractTitle(b().bodyMd)}</h1>

            {/* Meta */}
            <p class={metaLine}>
              model: {b().model} · prompt: {b().promptVersion}
              <Show when={b().publishedAt}>
                {(ts) => (
                  <>
                    {" · published: "}
                    {new Date(ts()).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </>
                )}
              </Show>
            </p>

            {/* Publish button */}
            <Show when={b().visibility === "private"}>
              <div class={css({ mt: "3" })}>
                <UIButton
                  variant="solid"
                  onClick={handlePublish}
                  disabled={publishing()}
                >
                  {publishing() ? "Publishing..." : "Publish to Notion"}
                </UIButton>
              </div>
            </Show>

            <Show when={notice()}>
              {(msg) => (
                <p class={css({ color: "zodiac.cream", mt: "2" })}>{msg()}</p>
              )}
            </Show>

            {/* Rendered Markdown Body */}
            <hr class={goldDivider} />
            <div class={markdownWrapper}>
              <SolidMarkdown children={b().bodyMd} />
            </div>

            {/* Todo Items */}
            <Show when={(b().todo ?? []).length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Action Items</div>
              <ul
                class={css({
                  color: "rgba(245, 240, 232, 0.7)",
                  fontFamily: "display",
                  listStyleType: "disc",
                  pl: "5",
                })}
              >
                <For each={b().todo}>
                  {(item) => (
                    <li class={css({ py: "1" })}>{item}</li>
                  )}
                </For>
              </ul>
            </Show>

            {/* Footer meta */}
            <hr class={goldDivider} />
            <div class={metaLine}>
              Created:{" "}
              {new Date(b().createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {" | "}Visibility: {b().visibility}
              <Show when={b().notionPageId}>
                {(id) => <>{" | "}Notion: {id()}</>}
              </Show>
            </div>
          </UICard>
        )}
      </Show>
    </section>
  );
}
