import { Link, useParams } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard, pageClass } from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import { createMutation, createQuery } from "../integrations/convex";
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

const bodyClass = css({
  color: "rgba(245, 240, 232, 0.7)",
  fontFamily: "display",
  fontSize: "md",
  lineHeight: "1.75",
  whiteSpace: "pre-wrap",
});

const questionClass = css({
  color: "rgba(245, 240, 232, 0.85)",
  fontFamily: "display",
  fontSize: "lg",
  lineHeight: "1.75",
});

const sourceGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
});

const sourceCell = css({
  borderColor: "rgba(200, 168, 75, 0.25)",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "3",
});

const metaLine = css({
  color: "rgba(245, 240, 232, 0.4)",
  fontFamily: "mono",
  fontSize: "xs",
});

const STATUSES = [
  "draft",
  "queued",
  "active",
  "evaluated",
  "revised",
  "retired",
] as const;

const RESOLUTIONS = ["supported", "inconclusive", "contradicted"] as const;

export function HypothesisDetailPage() {
  const params = useParams({ from: "/hypotheses/$hypothesisId" });

  const hypothesis = createQuery(convexApi.hypotheses.get, () => ({
    id: params().hypothesisId as Id<"hypotheses">,
  }));

  const updateHypothesis = createMutation(convexApi.hypotheses.update);

  function setStatus(status: string) {
    updateHypothesis(
      withDevBypassSecret({
        id: params().hypothesisId as Id<"hypotheses">,
        status: status as any,
      }),
    );
  }

  function setResolution(resolution: string) {
    updateHypothesis(
      withDevBypassSecret({
        id: params().hypothesisId as Id<"hypotheses">,
        resolution: resolution as any,
      }),
    );
  }

  return (
    <section class={pageClass}>
      <div>
        <Link to="/hypotheses" class={backLink}>
          <span aria-hidden="true">&larr;</span> Hypotheses
        </Link>
      </div>

      <Show
        when={hypothesis()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>
              Loading hypothesis...
            </p>
          </UICard>
        }
      >
        {(h) => (
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
              <UIBadge tone="gold">{h().status}</UIBadge>
              <UIBadge tone="violet">
                {h().sourceIds.length} citations
              </UIBadge>
              <Show when={h().resolution}>
                {(res) => <UIBadge tone="cream">{res()}</UIBadge>}
              </Show>
            </div>

            {/* Title */}
            <h1 class={titleClass}>{h().title}</h1>

            {/* Question */}
            <hr class={goldDivider} />
            <div class={sectionLabel}>Question</div>
            <p class={questionClass}>{h().question}</p>

            {/* Hypothesis */}
            <hr class={goldDivider} />
            <div class={sectionLabel}>Hypothesis</div>
            <p class={bodyClass}>{h().hypothesis}</p>

            {/* Rationale */}
            <hr class={goldDivider} />
            <div class={sectionLabel}>Rationale</div>
            <div class={bodyClass}>{h().rationaleMd}</div>

            {/* Concepts */}
            <Show when={(h().concepts ?? []).length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Concepts</div>
              <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
                <For each={h().concepts}>
                  {(concept) => <UIBadge tone="violet">{concept}</UIBadge>}
                </For>
              </div>
            </Show>

            {/* Open Questions */}
            <Show when={(h().openQuestions ?? []).length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Open Questions</div>
              <ul
                class={css({
                  color: "rgba(245, 240, 232, 0.7)",
                  fontFamily: "display",
                  listStyleType: "disc",
                  pl: "5",
                })}
              >
                <For each={h().openQuestions}>
                  {(q) => (
                    <li class={css({ py: "1" })}>{q}</li>
                  )}
                </For>
              </ul>
            </Show>

            {/* Linked Sources */}
            <Show when={h().sources.length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Linked Sources</div>
              <div class={sourceGrid}>
                <For each={h().sources}>
                  {(source: any) => (
                    <div class={sourceCell}>
                      <div
                        class={css({
                          display: "flex",
                          gap: "2",
                          mb: "1",
                        })}
                      >
                        <UIBadge tone="cream">
                          {source.sourceType ?? "unknown"}
                        </UIBadge>
                      </div>
                      <div
                        class={css({
                          color: "zodiac.cream",
                          fontSize: "sm",
                          fontWeight: "medium",
                        })}
                      >
                        {source.title ?? "Untitled"}
                      </div>
                      <Show when={source.canonicalUrl}>
                        {(url) => (
                          <a
                            href={url()}
                            target="_blank"
                            rel="noopener noreferrer"
                            class={css({
                              color: "rgba(139, 92, 246, 0.8)",
                              display: "block",
                              fontFamily: "mono",
                              fontSize: "2xs",
                              mt: "1",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              _hover: { color: "zodiac.violet" },
                            })}
                          >
                            {url()}
                          </a>
                        )}
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Status Controls */}
            <hr class={goldDivider} />
            <div class={sectionLabel}>Status</div>
            <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
              <For each={STATUSES}>
                {(status) => (
                  <UIButton
                    variant={h().status === status ? "solid" : "outline"}
                    size="sm"
                    onClick={() => setStatus(status)}
                  >
                    {status}
                  </UIButton>
                )}
              </For>
            </div>

            {/* Resolution (only when evaluated) */}
            <Show when={h().status === "evaluated"}>
              <div
                class={css({
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "2",
                  mt: "3",
                })}
              >
                <span class={sectionLabel}>Resolution</span>
                <For each={RESOLUTIONS}>
                  {(res) => (
                    <UIButton
                      variant={h().resolution === res ? "solid" : "outline"}
                      size="sm"
                      onClick={() => setResolution(res)}
                    >
                      {res}
                    </UIButton>
                  )}
                </For>
              </div>
            </Show>

            {/* Meta */}
            <hr class={goldDivider} />
            <div class={metaLine}>
              Created:{" "}
              {new Date(h().createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {" | "}Updated:{" "}
              {new Date(h().updatedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {" | "}Visibility: {h().visibility}
            </div>
          </UICard>
        )}
      </Show>
    </section>
  );
}
