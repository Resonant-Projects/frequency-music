import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, createSignal, For, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  Markdown,
  UIBadge,
  UIButton,
  UICard,
  backLink,
  detailTitleClass,
  goldDivider,
  metaLine,
  pageClass,
  sectionLabel,
} from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import { createAction, createQuery } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";
import { extractTitle } from "../lib/markdown-utils";

export function WeeklyBriefDetailPage() {
  const params = useParams({ from: "/weekly-turns/$briefId" });

  const brief = createQuery(convexApi.weeklyBriefs.get, () => ({
    id: params().briefId as Id<"weeklyBriefs">,
  }));

  createEffect(() => { const b = brief(); if (b) document.title = `Week ${b.weekOf} — Frequency Music`; });

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
      console.error("Weekly brief publish failed", error);
      setNotice("Publish failed. Please try again or contact support.");
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
            <h1 class={detailTitleClass}>{extractTitle(b().bodyMd)}</h1>

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
            <Markdown content={b().bodyMd} />

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
