import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, createSignal, For, on, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  backLink,
  collapsedNoticeClass,
  detailTitleClass,
  fieldLabelClass,
  goldDivider,
  metaLine,
  pageClass,
  sectionLabel,
  UIBadge,
  UIButton,
  UICard,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import { createMutation, createQuery } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const bodyClass = css({
  color: "zodiac.cream/70",
  fontFamily: "display",
  fontSize: "md",
  lineHeight: "1.75",
  whiteSpace: "pre-wrap",
});

const questionClass = css({
  color: "zodiac.cream/85",
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
  borderColor: "zodiac.gold/25",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "3",
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
type Status = (typeof STATUSES)[number];
type Resolution = (typeof RESOLUTIONS)[number];
type HypothesisSource = Doc<"sources">;

export function HypothesisDetailPage() {
  const params = useParams({ from: "/hypotheses/$hypothesisId" });

  const hypothesis = createQuery(api.hypotheses.get, () => ({
    id: params().hypothesisId as Id<"hypotheses">,
  }));
  const theses = createQuery(api.theses.list, () => ({
    limit: 100,
  }));

  createEffect(() => {
    const h = hypothesis();
    if (h) document.title = `${h.title} — Frequency Music`;
  });

  const updateHypothesis = createMutation(api.hypotheses.update);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [whyThisMattersDraft, setWhyThisMattersDraft] = createSignal("");
  const [thesisIdDraft, setThesisIdDraft] = createSignal("");
  // Set by the meaning-metadata inputs, cleared on a successful save. Keeps a
  // background Convex push from clobbering an in-flight edit.
  const [dirty, setDirty] = createSignal(false);
  let seededHypothesisId: string | null = null;

  createEffect(
    on(
      hypothesis,
      (row) => {
        if (!row) return;
        const rowId = String(row._id);
        const isNewRecord = rowId !== seededHypothesisId;
        // Only (re)seed when the record changed or the drafts are untouched.
        if (!isNewRecord && dirty()) return;
        seededHypothesisId = rowId;
        setWhyThisMattersDraft(row.whyThisMatters ?? "");
        setThesisIdDraft(row.thesis?._id ? String(row.thesis._id) : "");
        setDirty(false);
      },
      { defer: false },
    ),
  );

  async function setStatus(status: Status) {
    await updateHypothesis({
      id: params().hypothesisId as Id<"hypotheses">,
      status,
    });
  }

  async function setResolution(resolution: Resolution) {
    await updateHypothesis({
      id: params().hypothesisId as Id<"hypotheses">,
      resolution,
    });
  }

  async function handleStatusClick(status: Status) {
    setSaving(true);
    setNotice(null);
    setNoticeError(null);
    try {
      await setStatus(status);
    } catch (error) {
      setNoticeError(
        error instanceof Error
          ? error.message
          : "Failed to update hypothesis status.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleResolutionClick(resolution: Resolution) {
    setSaving(true);
    setNotice(null);
    setNoticeError(null);
    try {
      await setResolution(resolution);
    } catch (error) {
      setNoticeError(
        error instanceof Error
          ? error.message
          : "Failed to update hypothesis resolution.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveMeaningMetadata() {
    setSaving(true);
    setNotice(null);
    setNoticeError(null);
    // The drafts this mutation carries. An edit made while it is in flight has
    // to leave `dirty` set, or the Convex push that follows the write would
    // reseed both drafts over the newer text.
    const sentWhyThisMatters = whyThisMattersDraft();
    const sentThesisId = thesisIdDraft();
    try {
      await updateHypothesis({
        id: params().hypothesisId as Id<"hypotheses">,
        whyThisMatters: sentWhyThisMatters.trim() || undefined,
        thesisId: sentThesisId ? (sentThesisId as Id<"theses">) : null,
      });
      if (
        whyThisMattersDraft() === sentWhyThisMatters &&
        thesisIdDraft() === sentThesisId
      ) {
        setDirty(false);
      }
      setNotice("Meaning metadata updated.");
    } catch (error) {
      setNoticeError(
        error instanceof Error
          ? error.message
          : "Failed to update meaning metadata.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section class={pageClass}>
      <div>
        <Link to="/hypotheses" class={backLink}>
          <span aria-hidden="true">&larr;</span> Hypotheses
        </Link>
      </div>

      <UINotice
        class={hypothesis() ? collapsedNoticeClass : undefined}
        status={hypothesis() ? null : "Loading hypothesis..."}
      />

      <Show when={hypothesis()}>
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
              <UIBadge tone="violet">{h().sourceIds.length} citations</UIBadge>
              <Show when={h().resolution}>
                {(res) => <UIBadge tone="cream">{res()}</UIBadge>}
              </Show>
            </div>

            {/* Title */}
            <h1 class={detailTitleClass}>{h().title}</h1>
            <UINotice
              class={css({ mt: "2" })}
              status={notice()}
              error={noticeError()}
            />

            {/* Question */}
            <hr class={goldDivider} />
            <h2 class={sectionLabel}>Question</h2>
            <p class={questionClass}>{h().question}</p>

            {/* Hypothesis */}
            <hr class={goldDivider} />
            <h2 class={sectionLabel}>Hypothesis</h2>
            <p class={bodyClass}>{h().hypothesis}</p>

            <Show when={h().whyThisMatters}>
              {(value) => (
                <>
                  <hr class={goldDivider} />
                  <h2 class={sectionLabel}>Why This Matters</h2>
                  <p class={bodyClass}>{value()}</p>
                </>
              )}
            </Show>

            <Show when={h().thesis}>
              {(thesis) => (
                <>
                  <hr class={goldDivider} />
                  <h2 class={sectionLabel}>Linked Thesis</h2>
                  <p class={questionClass}>{thesis().title}</p>
                  <p class={bodyClass}>{thesis().statement}</p>
                </>
              )}
            </Show>

            {/* Rationale */}
            <hr class={goldDivider} />
            <h2 class={sectionLabel}>Rationale</h2>
            <div class={bodyClass}>{h().rationaleMd}</div>

            {/* Concepts */}
            <Show when={(h().concepts ?? []).length > 0}>
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Concepts</h2>
              <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
                <For each={h().concepts}>
                  {(concept) => <UIBadge tone="violet">{concept}</UIBadge>}
                </For>
              </div>
            </Show>

            {/* Open Questions */}
            <Show when={(h().openQuestions ?? []).length > 0}>
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Open Questions</h2>
              <ul
                class={css({
                  color: "zodiac.cream/70",
                  fontFamily: "display",
                  listStyleType: "disc",
                  pl: "5",
                })}
              >
                <For each={h().openQuestions}>
                  {(q) => <li class={css({ py: "1" })}>{q}</li>}
                </For>
              </ul>
            </Show>

            {/* Linked Sources */}
            <Show when={h().sources.length > 0}>
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Linked Sources</h2>
              <div class={sourceGrid}>
                <For each={h().sources}>
                  {(source: HypothesisSource) => (
                    <div class={sourceCell}>
                      <div
                        class={css({
                          display: "flex",
                          gap: "2",
                          mb: "1",
                        })}
                      >
                        <UIBadge tone="cream">{source.type}</UIBadge>
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
                              color: "zodiac.violetText",
                              display: "block",
                              fontFamily: "mono",
                              fontSize: "xs",
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
            <h2 class={sectionLabel}>Meaning Metadata</h2>
            <div class={css({ display: "grid", gap: "3", mb: "4" })}>
              <div>
                <label class={fieldLabelClass} for="hyp-detail-thesis">
                  Thesis
                </label>
                <UISelect
                  id="hyp-detail-thesis"
                  value={thesisIdDraft()}
                  onChange={(event) => {
                    setDirty(true);
                    setThesisIdDraft(event.currentTarget.value);
                  }}
                >
                  <option value="">No thesis yet</option>
                  <For each={theses() ?? []}>
                    {(thesis: Doc<"theses">) => (
                      <option value={String(thesis._id)}>
                        {thesis.title} ({thesis.status})
                      </option>
                    )}
                  </For>
                </UISelect>
              </div>
              <div>
                <label class={fieldLabelClass} for="hyp-detail-why">
                  Why This Matters
                </label>
                <UITextarea
                  id="hyp-detail-why"
                  value={whyThisMattersDraft()}
                  onInput={(event) => {
                    setDirty(true);
                    setWhyThisMattersDraft(event.currentTarget.value);
                  }}
                />
              </div>
              <div class={css({ display: "flex", justifyContent: "flex-end" })}>
                <UIButton
                  variant="solid"
                  disabled={saving()}
                  onClick={() => void saveMeaningMetadata()}
                >
                  Save Meaning Metadata
                </UIButton>
              </div>
            </div>

            <hr class={goldDivider} />
            <h2 class={sectionLabel}>Status</h2>
            <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
              <For each={STATUSES}>
                {(status) => (
                  <UIButton
                    variant={h().status === status ? "solid" : "outline"}
                    aria-pressed={h().status === status}
                    disabled={saving()}
                    onClick={() => void handleStatusClick(status)}
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
                <h2 class={sectionLabel}>Resolution</h2>
                <For each={RESOLUTIONS}>
                  {(res) => (
                    <UIButton
                      variant={h().resolution === res ? "solid" : "outline"}
                      aria-pressed={h().resolution === res}
                      disabled={saving()}
                      onClick={() => void handleResolutionClick(res)}
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
