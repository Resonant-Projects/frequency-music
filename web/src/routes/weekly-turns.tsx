import { Link } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
} from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import { createAction, createQueryWithStatus } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";
import { extractTitle } from "../lib/markdown-utils";

function extractExcerpt(bodyMd: string, maxLen = 180): string {
  // Skip the first heading line, grab the next non-empty lines as plain text
  const lines = bodyMd.split("\n");
  const contentLines: string[] = [];
  let pastFirstHeading = false;

  for (const line of lines) {
    if (!pastFirstHeading) {
      if (line.match(/^#\s+/)) {
        pastFirstHeading = true;
      }
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Strip markdown formatting for plain text excerpt
    const plain = trimmed
      .replace(/^#{1,6}\s+/, "")
      .replaceAll(/\*\*(.*?)\*\*/g, "$1")
      .replaceAll(/\*(.*?)\*/g, "$1")
      .replaceAll(/`(.*?)`/g, "$1")
      .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    contentLines.push(plain);
    if (contentLines.join(" ").length >= maxLen) break;
  }

  const text = contentLines.join(" ");
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

export function WeeklyTurnsPage() {
  onMount(() => {
    document.title = "Weekly Turns — Frequency Music";
  });

  const briefs = createQueryWithStatus(convexApi.weeklyBriefs.list, () => ({
    limit: 12,
  }));
  const briefRows = createMemo<Doc<"weeklyBriefs">[]>(
    () => (briefs.data() ?? []) as Doc<"weeklyBriefs">[],
  );

  const generateBrief = createAction(convexApi.weeklyBriefs.generate);

  const [notice, setNotice] = createSignal<string | null>(null);

  async function runGenerate() {
    setNotice(null);
    try {
      const result = await generateBrief(withDevBypassSecret({ daysBack: 7 }));
      setNotice(`Weekly turn generated for ${result.weekOf}.`);
    } catch (error) {
      setNotice(`Generation failed: ${String(error)}`);
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
            <h1 class={pageTitleClass}>Weekly Turns</h1>
            <p
              class={css({
                color: "rgba(245, 240, 232, 0.62)",
                lineHeight: "1.6",
              })}
            >
              Weekly briefs summarize the ingest cycle into experiment cards,
              hypothesis focus, and recipe recommendations.
            </p>
          </div>
          <UIButton variant="solid" onClick={runGenerate}>
            Generate Now
          </UIButton>
        </div>

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
        <h2 class={sectionTitleClass}>Generated Briefs</h2>

        <Show
          when={!briefs.isLoading()}
          fallback={<p>Loading weekly turns...</p>}
        >
          <Show
            when={briefRows().length > 0}
            fallback={
              <p
                class={css({
                  color: "rgba(245, 240, 232, 0.55)",
                  fontFamily: "display",
                  fontSize: "md",
                  lineHeight: "1.6",
                  textAlign: "center",
                  py: "8",
                })}
              >
                No weekly turns yet. Generate one to summarize the latest ingest
                cycle.
              </p>
            }
          >
            <div class={css({ display: "grid", gap: "3" })}>
              <For each={briefRows()}>
                {(brief) => (
                  <Link
                    to="/weekly-turns/$briefId"
                    params={{ briefId: String(brief._id) }}
                    class={css({
                      borderColor: "rgba(200, 168, 75, 0.25)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      cursor: "pointer",
                      display: "block",
                      p: "4",
                      textDecoration: "none",
                      transition: "border-color 0.15s",
                      _hover: {
                        borderColor: "rgba(200, 168, 75, 0.5)",
                      },
                    })}
                  >
                    <div
                      class={css({
                        alignItems: "center",
                        display: "flex",
                        gap: "2",
                        justifyContent: "space-between",
                        marginBottom: "2",
                      })}
                    >
                      <div
                        class={css({
                          display: "flex",
                          gap: "2",
                          flexWrap: "wrap",
                        })}
                      >
                        <UIBadge tone="gold">Week {brief.weekOf}</UIBadge>
                        <UIBadge tone="cream">{brief.visibility}</UIBadge>
                        <Show when={(brief.activeThesisIds ?? []).length > 0}>
                          <UIBadge tone="violet">
                            {(brief.activeThesisIds ?? []).length} theses
                          </UIBadge>
                        </Show>
                        <Show
                          when={(brief.referencedFailureKeys ?? []).length > 0}
                        >
                          <UIBadge tone="violet">
                            {(brief.referencedFailureKeys ?? []).length}{" "}
                            reversals
                          </UIBadge>
                        </Show>
                        <Show when={brief.publishedAt}>
                          {(ts) => (
                            <UIBadge tone="violet">
                              Published{" "}
                              {new Date(ts()).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </UIBadge>
                          )}
                        </Show>
                      </div>
                    </div>

                    <h3
                      class={css({
                        color: "zodiac.cream",
                        fontFamily: "display",
                        fontSize: "lg",
                        fontWeight: "normal",
                        lineHeight: "1.4",
                        mb: "2",
                      })}
                    >
                      {extractTitle(brief.bodyMd)}
                    </h3>

                    <p
                      class={css({
                        color: "rgba(245, 240, 232, 0.55)",
                        fontFamily: "body",
                        fontSize: "sm",
                        lineHeight: "1.6",
                        mb: "2",
                      })}
                    >
                      {extractExcerpt(brief.bodyMd)}
                    </p>

                    <p
                      class={css({
                        color: "rgba(245, 240, 232, 0.55)",
                        fontFamily: "mono",
                        fontSize: "xs",
                      })}
                    >
                      model: {brief.model} · prompt: {brief.promptVersion}
                    </p>
                  </Link>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
