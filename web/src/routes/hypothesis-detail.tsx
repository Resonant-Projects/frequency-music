import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, createSignal, For, on, onMount, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { entityCellClass } from "../components/entity-card";
import {
  backLink,
  badgeRowClass,
  collapsedNoticeClass,
  DateTime,
  detailTitleClass,
  fieldLabelClass,
  goldDivider,
  Markdown,
  metaLine,
  pageClass,
  proseClass,
  sectionLabel,
  srOnlyClass,
  UIBadge,
  UIButton,
  UICard,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
  describeLoad,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const bodyClass = cx(proseClass, css({ whiteSpace: "pre-wrap" }));

const questionClass = css({
  color: "zodiac.cream/85",
  fontFamily: "display",
  fontSize: "lg",
  lineHeight: "prose",
  maxW: "measure",
});

const sourceGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "repeat(2, minmax(0, 1fr))",
  },
});

const headerBadgesClass = cx(badgeRowClass, css({ mb: "2" }));

const openQuestionsClass = css({
  color: "zodiac.cream/82",
  fontFamily: "display",
  listStyleType: "disc",
  maxW: "measure",
  pl: "5",
});

const openQuestionClass = css({ py: "1" });

const sourceTypeRowClass = css({ display: "flex", gap: "2", mb: "1" });

const sourceTitleClass = css({
  color: "zodiac.cream",
  fontSize: "sm",
  fontWeight: "medium",
});

const sourceUrlClass = css({
  color: "zodiac.violetText",
  display: "block",
  fontFamily: "mono",
  fontSize: "xs",
  mt: "1",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  _hover: { textDecoration: "underline" },
});

const choiceRowClass = css({ display: "flex", flexWrap: "wrap", gap: "2" });

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

  const hypothesisQuery = createQueryWithStatus(api.hypotheses.get, () => ({
    id: params().hypothesisId as Id<"hypotheses">,
  }));
  const hypothesis = hypothesisQuery.data;
  const thesesQuery = createQueryWithStatus(api.theses.list, () => ({
    limit: 100,
  }));

  onMount(() => {
    document.title = "Hypothesis — Frequency Music";
  });

  createEffect(() => {
    const h = hypothesis();
    if (h) document.title = `${h.title} — Frequency Music`;
  });

  const load = describeLoad(hypothesisQuery, "hypothesis");

  const updateHypothesis = createMutation(api.hypotheses.update);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  // Which control the in-flight write came from, so only that button reports
  // `aria-busy`. Buttons stay enabled (a disabled control drops focus); the
  // handlers guard on `saving()` instead.
  const [pending, setPending] = createSignal<string | null>(null);
  const saving = () => pending() !== null;
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
    if (saving()) return;
    setPending(`status:${status}`);
    setNotice(null);
    setNoticeError(null);
    try {
      await setStatus(status);
    } catch (error) {
      setNoticeError(describeError(error));
    } finally {
      setPending(null);
    }
  }

  async function handleResolutionClick(resolution: Resolution) {
    if (saving()) return;
    setPending(`resolution:${resolution}`);
    setNotice(null);
    setNoticeError(null);
    try {
      await setResolution(resolution);
    } catch (error) {
      setNoticeError(describeError(error));
    } finally {
      setPending(null);
    }
  }

  async function saveMeaningMetadata() {
    if (saving()) return;
    setPending("meaning");
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
      setNoticeError(describeError(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <section class={pageClass}>
      <div>
        <Link to="/hypotheses" class={backLink}>
          <span aria-hidden="true">&larr;</span> Hypotheses
        </Link>
      </div>

      <UICard class={hypothesis() ? collapsedNoticeClass : undefined}>
        <UINotice status={load.status()} error={load.error()} />
      </UICard>

      <Show when={hypothesis()}>
        {(h) => (
          <UICard>
            {/* Badges */}
            <div class={headerBadgesClass}>
              <UIBadge tone="gold">{h().status}</UIBadge>
              <UIBadge tone="cream">{h().sourceIds.length} citations</UIBadge>
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
            <Markdown content={h().rationaleMd} />

            {/* Concepts */}
            <Show when={(h().concepts ?? []).length > 0}>
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Concepts</h2>
              <div class={choiceRowClass}>
                <For each={h().concepts}>
                  {(concept) => <UIBadge tone="violet">{concept}</UIBadge>}
                </For>
              </div>
            </Show>

            {/* Open Questions */}
            <Show when={(h().openQuestions ?? []).length > 0}>
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Open Questions</h2>
              <ul class={openQuestionsClass}>
                <For each={h().openQuestions}>
                  {(q) => <li class={openQuestionClass}>{q}</li>}
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
                    <div class={entityCellClass}>
                      <div class={sourceTypeRowClass}>
                        <UIBadge tone="cream">{source.type}</UIBadge>
                      </div>
                      <div class={sourceTitleClass}>
                        {source.title ?? "Untitled"}
                      </div>
                      <Show when={source.canonicalUrl}>
                        {(url) => (
                          <a
                            href={url()}
                            target="_blank"
                            rel="noopener noreferrer"
                            class={sourceUrlClass}
                          >
                            {url()}
                            <span class={srOnlyClass}>
                              {" "}
                              (opens in a new tab)
                            </span>
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
                  <For each={thesesQuery.data() ?? []}>
                    {(thesis: Doc<"theses">) => (
                      <option value={String(thesis._id)}>
                        {thesis.title} ({thesis.status})
                      </option>
                    )}
                  </For>
                </UISelect>
                <UINotice
                  error={
                    thesesQuery.error()
                      ? `Unable to load theses: ${thesesQuery.error()?.message}`
                      : null
                  }
                />
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
                  aria-busy={pending() === "meaning"}
                  onClick={() => void saveMeaningMetadata()}
                >
                  Save Meaning Metadata
                </UIButton>
              </div>
            </div>

            <hr class={goldDivider} />
            <h2 id="hyp-status-heading" class={sectionLabel}>
              Status
            </h2>
            <div
              role="group"
              aria-labelledby="hyp-status-heading"
              class={choiceRowClass}
            >
              <For each={STATUSES}>
                {(status) => (
                  <UIButton
                    variant="outline"
                    aria-pressed={h().status === status}
                    aria-busy={pending() === `status:${status}`}
                    onClick={() => void handleStatusClick(status)}
                  >
                    {status}
                  </UIButton>
                )}
              </For>
            </div>

            {/* Resolution (only when evaluated) */}
            <Show when={h().status === "evaluated"}>
              <div class={css({ mt: "4" })}>
                <h2 id="hyp-resolution-heading" class={sectionLabel}>
                  Resolution
                </h2>
                <div
                  role="group"
                  aria-labelledby="hyp-resolution-heading"
                  class={choiceRowClass}
                >
                  <For each={RESOLUTIONS}>
                    {(res) => (
                      <UIButton
                        variant="outline"
                        aria-pressed={h().resolution === res}
                        aria-busy={pending() === `resolution:${res}`}
                        onClick={() => void handleResolutionClick(res)}
                      >
                        {res}
                      </UIButton>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Meta */}
            <hr class={goldDivider} />
            <div class={metaLine}>
              Created: <DateTime value={h().createdAt} />
              {" | "}Updated: <DateTime value={h().updatedAt} />
              {" | "}Visibility: {h().visibility}
            </div>
          </UICard>
        )}
      </Show>
    </section>
  );
}
