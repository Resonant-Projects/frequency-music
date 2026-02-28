import { createSignal, For, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard } from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import {
  createAction,
  createMutation,
  createQueryWithStatus,
} from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const pageClass = css({
  display: "grid",
  gap: "6",
  p: { base: "4", md: "6" },
});

const sectionTitleClass = css({
  color: "zodiac.gold",
  fontSize: "lg",
  letterSpacing: "0.12em",
  marginBottom: "3",
  textTransform: "uppercase",
});

export function WeeklyTurnsPage() {
  const briefs = createQueryWithStatus(convexApi.weeklyBriefs.list, () => ({
    limit: 12,
  }));

  const generateBrief = createAction(convexApi.weeklyBriefs.generate);
  const publishBrief = createMutation(convexApi.weeklyBriefs.publish);

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

  async function publish(id: string) {
    try {
      await publishBrief(withDevBypassSecret({ id: id as Id<"weeklyBriefs"> }));
      setNotice("Weekly turn published.");
    } catch (error) {
      setNotice(`Publish failed: ${String(error)}`);
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
            <h1 class={sectionTitleClass}>Weekly Turns</h1>
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

        <Show when={notice()}>
          {(message) => (
            <p class={css({ color: "zodiac.cream", marginTop: "3" })}>
              {message()}
            </p>
          )}
        </Show>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Generated Briefs</h2>

        <Show
          when={!briefs.isLoading()}
          fallback={<p>Loading weekly turns…</p>}
        >
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={briefs.data() ?? []}>
              {(brief: any) => (
                <div
                  class={css({
                    borderColor: "rgba(200, 168, 75, 0.25)",
                    borderRadius: "l2",
                    borderWidth: "1px",
                    p: "4",
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
                    <div class={css({ display: "flex", gap: "2" })}>
                      <UIBadge tone="gold">Week {brief.weekOf}</UIBadge>
                      <UIBadge tone="cream">{brief.visibility}</UIBadge>
                    </div>
                    <UIButton
                      variant="outline"
                      disabled={brief.visibility === "public"}
                      onClick={() => publish(String(brief._id))}
                    >
                      Publish
                    </UIButton>
                  </div>

                  <p
                    class={css({
                      color: "rgba(245, 240, 232, 0.7)",
                      fontFamily: "mono",
                      fontSize: "xs",
                      marginBottom: "2",
                    })}
                  >
                    model: {brief.model} · prompt: {brief.promptVersion}
                  </p>

                  <pre
                    class={css({
                      bg: "rgba(13, 6, 32, 0.5)",
                      borderRadius: "l1",
                      color: "rgba(245, 240, 232, 0.72)",
                      fontFamily: "body",
                      fontSize: "sm",
                      lineHeight: "1.65",
                      maxH: "64",
                      overflow: "auto",
                      p: "3",
                      whiteSpace: "pre-wrap",
                    })}
                  >
                    {brief.bodyMd}
                  </pre>
                </div>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
