import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  Markdown,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UITextarea,
  backLink,
  detailTitleClass,
  fieldLabelClass,
  goldDivider,
  metaLine,
  pageClass,
  sectionLabel,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const lineItem = css({
  borderColor: "rgba(200, 168, 75, 0.18)",
  borderRadius: "l2",
  borderWidth: "1px",
  p: "3",
});

function parseLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonArray<T>(value: string, label: string): T[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`);
  }
  return parsed as T[];
}

function jsonArrayChanged(value: string, original: unknown[]) {
  try {
    return JSON.stringify(JSON.parse(value)) !== JSON.stringify(original);
  } catch {
    return true;
  }
}

function ExtractionCorrection(props: { extraction: Doc<"extractions"> }) {
  const editExtraction = createMutation(api.extractions.editExtraction);
  const [editMode, setEditMode] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [summary, setSummary] = createSignal("");
  const [claimsJson, setClaimsJson] = createSignal("");
  const [parametersJson, setParametersJson] = createSignal("");
  const [topicsText, setTopicsText] = createSignal("");
  const [questionsText, setQuestionsText] = createSignal("");
  const [confidenceText, setConfidenceText] = createSignal("");

  const originalClaimsJson = () =>
    JSON.stringify(props.extraction.claims, null, 2);
  const originalParametersJson = () =>
    JSON.stringify(props.extraction.compositionParameters, null, 2);

  const changedFields = createMemo(() => {
    if (!editMode()) return [];
    const fields: string[] = [];
    if (summary() !== props.extraction.summary) fields.push("summary");
    if (jsonArrayChanged(claimsJson(), props.extraction.claims)) {
      fields.push("claims");
    }
    if (
      jsonArrayChanged(parametersJson(), props.extraction.compositionParameters)
    ) {
      fields.push("compositionParameters");
    }
    if (
      JSON.stringify(parseLines(topicsText())) !==
      JSON.stringify(props.extraction.topics)
    ) {
      fields.push("topics");
    }
    if (
      JSON.stringify(parseLines(questionsText())) !==
      JSON.stringify(props.extraction.openQuestions)
    ) {
      fields.push("openQuestions");
    }
    if (Number(confidenceText()) !== props.extraction.confidence) {
      fields.push("confidence");
    }
    return fields;
  });

  function beginEdit() {
    setSummary(props.extraction.summary);
    setClaimsJson(originalClaimsJson());
    setParametersJson(originalParametersJson());
    setTopicsText(props.extraction.topics.join("\n"));
    setQuestionsText(props.extraction.openQuestions.join("\n"));
    setConfidenceText(String(props.extraction.confidence));
    setNotice(null);
    setEditMode(true);
  }

  async function saveCorrection() {
    const fields = changedFields();
    if (fields.length === 0) return;
    setSaving(true);
    setNotice(null);
    try {
      const confidence = Number(confidenceText());
      if (fields.includes("confidence") && !Number.isFinite(confidence)) {
        throw new Error("Confidence must be a number.");
      }
      await editExtraction({
        id: props.extraction._id,
        ...(fields.includes("summary") ? { summary: summary() } : {}),
        ...(fields.includes("claims")
          ? {
              claims: parseJsonArray<Doc<"extractions">["claims"][number]>(
                claimsJson(),
                "Claims",
              ),
            }
          : {}),
        ...(fields.includes("compositionParameters")
          ? {
              compositionParameters: parseJsonArray<
                Doc<"extractions">["compositionParameters"][number]
              >(parametersJson(), "Composition parameters"),
            }
          : {}),
        ...(fields.includes("topics")
          ? { topics: parseLines(topicsText()) }
          : {}),
        ...(fields.includes("openQuestions")
          ? { openQuestions: parseLines(questionsText()) }
          : {}),
        ...(fields.includes("confidence") ? { confidence } : {}),
      });
      setEditMode(false);
      setNotice("Extraction correction saved with edit provenance.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not save extraction.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        class={css({
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: "2",
          justifyContent: "space-between",
          mt: "2",
        })}
      >
        <span class={metaLine}>
          confidence {props.extraction.confidence} ·{" "}
          {props.extraction.topics.length} topics
        </span>
        <UIButton variant="outline" disabled={editMode()} onClick={beginEdit}>
          Correct extraction
        </UIButton>
      </div>

      <Show when={editMode()}>
        <div
          class={css({
            bg: "rgba(139, 92, 246, 0.07)",
            borderColor: "rgba(139, 92, 246, 0.3)",
            borderRadius: "l2",
            borderWidth: "1px",
            display: "grid",
            gap: "2",
            mt: "3",
            p: "3",
          })}
        >
          <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
            <For each={changedFields()}>
              {(field) => <UIBadge tone="violet">changed: {field}</UIBadge>}
            </For>
          </div>
          <p class={css({ color: "rgba(245, 240, 232, 0.68)" })}>
            Saving preserves the generated and edited field sets as eval
            provenance. Claims and parameters use their stored JSON shape.
          </p>
          <label
            class={fieldLabelClass}
            for={`extraction-summary-${props.extraction._id}`}
          >
            Summary
          </label>
          <UITextarea
            id={`extraction-summary-${props.extraction._id}`}
            value={summary()}
            onInput={(event) => setSummary(event.currentTarget.value)}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-claims-${props.extraction._id}`}
          >
            Claims JSON
          </label>
          <UITextarea
            id={`extraction-claims-${props.extraction._id}`}
            value={claimsJson()}
            onInput={(event) => setClaimsJson(event.currentTarget.value)}
            class={css({ minH: "72" })}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-parameters-${props.extraction._id}`}
          >
            Composition parameters JSON
          </label>
          <UITextarea
            id={`extraction-parameters-${props.extraction._id}`}
            value={parametersJson()}
            onInput={(event) => setParametersJson(event.currentTarget.value)}
            class={css({ minH: "56" })}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-topics-${props.extraction._id}`}
          >
            Topics (one per line)
          </label>
          <UITextarea
            id={`extraction-topics-${props.extraction._id}`}
            value={topicsText()}
            onInput={(event) => setTopicsText(event.currentTarget.value)}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-questions-${props.extraction._id}`}
          >
            Open questions (one per line)
          </label>
          <UITextarea
            id={`extraction-questions-${props.extraction._id}`}
            value={questionsText()}
            onInput={(event) => setQuestionsText(event.currentTarget.value)}
          />
          <label
            class={fieldLabelClass}
            for={`extraction-confidence-${props.extraction._id}`}
          >
            Confidence
          </label>
          <UIInput
            id={`extraction-confidence-${props.extraction._id}`}
            type="number"
            step="0.01"
            value={confidenceText()}
            onInput={(event) => setConfidenceText(event.currentTarget.value)}
          />
          <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
            <UIButton
              variant="solid"
              disabled={saving() || changedFields().length === 0}
              onClick={saveCorrection}
            >
              {saving() ? "Saving…" : "Save correction"}
            </UIButton>
            <UIButton
              variant="ghost"
              disabled={saving()}
              onClick={() => setEditMode(false)}
            >
              Cancel
            </UIButton>
          </div>
        </div>
      </Show>

      <Show when={notice()}>
        {(message) => (
          <p aria-live="polite" class={css({ color: "zodiac.cream", mt: "2" })}>
            {message()}
          </p>
        )}
      </Show>
    </>
  );
}

export function CompositionDetailPage() {
  const params = useParams({ from: "/compositions/$compositionId" });
  const lineageQuery = createQueryWithStatus(
    api.compositions.getLineage,
    () => ({
      id: params().compositionId as Id<"compositions">,
    }),
  );
  const lineage = lineageQuery.data;

  createEffect(() => {
    const row = lineage()?.composition;
    if (row) document.title = `${row.title} — Frequency Music`;
  });

  return (
    <section class={pageClass}>
      <div>
        <Link to="/compositions" class={backLink}>
          <span aria-hidden="true">&larr;</span> Compositions
        </Link>
      </div>

      <Show
        when={lineage()}
        fallback={
          <UICard>
            <p
              class={css({
                color: lineageQuery.isError() ? "zodiac.error" : "zodiac.cream",
              })}
            >
              {lineageQuery.isLoading()
                ? "Loading composition..."
                : lineageQuery.error()
                  ? `Unable to load composition: ${lineageQuery.error()?.message}`
                  : "Composition not found."}
            </p>
          </UICard>
        }
      >
        {(row) => (
          <UICard>
            <div
              class={css({
                display: "flex",
                gap: "2",
                flexWrap: "wrap",
                mb: "2",
              })}
            >
              <UIBadge tone="gold">{row().composition.status}</UIBadge>
              <UIBadge tone="violet">{row().composition.artifactType}</UIBadge>
              <UIBadge tone="cream">{row().composition.version}</UIBadge>
              <Show when={row().summary.localFailureStatus}>
                {(status) => <UIBadge tone="violet">local: {status()}</UIBadge>}
              </Show>
              <Show when={row().summary.branchFailureStatus}>
                {(status) => (
                  <UIBadge tone="violet">branch: {status()}</UIBadge>
                )}
              </Show>
            </div>

            <h1 class={detailTitleClass}>{row().composition.title}</h1>

            <p
              class={css({
                color: "rgba(245, 240, 232, 0.62)",
                fontSize: "sm",
                lineHeight: "1.7",
              })}
            >
              Depth {row().summary.depth} in revision branch
              <Show when={row().summary.revisionVariable}>
                {(variable) => <> · changed variable: {variable()}</>}
              </Show>
              <Show when={row().summary.latestExpandVerdict}>
                {(verdict) => <> · latest expand verdict: {verdict()}</>}
              </Show>
            </p>

            <Show
              when={
                row().summary.localFailureStatus ||
                row().summary.branchFailureStatus
              }
            >
              <hr class={goldDivider} />
              <div class={sectionLabel}>Archive Signal</div>
              <Show when={row().summary.localFailureStatus}>
                {(status) => (
                  <p
                    class={css({
                      color: "rgba(245, 240, 232, 0.76)",
                      lineHeight: "1.7",
                      mb: "2",
                    })}
                  >
                    This composition is currently classified locally as{" "}
                    <code>{status()}</code> based on its own listening history.
                  </p>
                )}
              </Show>
              <Show when={row().summary.branchFailureStatus}>
                {(status) => (
                  <p
                    class={css({
                      color: "rgba(245, 240, 232, 0.76)",
                      lineHeight: "1.7",
                    })}
                  >
                    This revision branch is currently classified as{" "}
                    <code>{status()}</code> in the derived failure archive.
                  </p>
                )}
              </Show>
            </Show>

            <hr class={goldDivider} />
            <div class={sectionLabel}>Lineage</div>
            <div class={css({ display: "grid", gap: "2" })}>
              <For each={row().ancestry}>
                {(ancestor) => (
                  <div class={lineItem}>
                    <Link
                      to="/compositions/$compositionId"
                      params={{ compositionId: String(ancestor._id) }}
                      class={css({
                        color: "zodiac.cream",
                        textDecoration: "none",
                      })}
                    >
                      {ancestor.title}
                    </Link>
                    <p
                      class={css({
                        color: "rgba(245, 240, 232, 0.55)",
                        fontSize: "sm",
                        mt: "1",
                      })}
                    >
                      {ancestor.version}
                      <Show when={ancestor.revisionVariable}>
                        {(variable) => <> · variable: {variable()}</>}
                      </Show>
                    </p>
                  </div>
                )}
              </For>
              <div class={lineItem}>
                <div class={css({ color: "zodiac.gold" })}>
                  {row().composition.title}
                </div>
                <p
                  class={css({
                    color: "rgba(245, 240, 232, 0.55)",
                    fontSize: "sm",
                    mt: "1",
                  })}
                >
                  current node
                </p>
              </div>
            </div>

            <Show when={row().children.length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Direct Revisions</div>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().children}>
                  {(child) => (
                    <div class={lineItem}>
                      <Link
                        to="/compositions/$compositionId"
                        params={{ compositionId: String(child._id) }}
                        class={css({
                          color: "zodiac.cream",
                          textDecoration: "none",
                        })}
                      >
                        {child.title}
                      </Link>
                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.55)",
                          fontSize: "sm",
                          mt: "1",
                        })}
                      >
                        {child.version}
                        <Show when={child.revisionVariable}>
                          {(variable) => <> · variable: {variable()}</>}
                        </Show>
                      </p>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <hr class={goldDivider} />
            <div class={sectionLabel}>Provenance</div>
            <div class={css({ display: "grid", gap: "3" })}>
              <Show when={row().recipe}>
                {(recipe) => (
                  <div class={lineItem}>
                    <div
                      class={css({
                        color: "zodiac.gold",
                        fontSize: "sm",
                        mb: "1",
                      })}
                    >
                      Recipe
                    </div>
                    <Link
                      to="/recipes/$recipeId"
                      params={{ recipeId: String(recipe()._id) }}
                      class={css({
                        color: "zodiac.cream",
                        textDecoration: "none",
                      })}
                    >
                      {recipe().title}
                    </Link>
                  </div>
                )}
              </Show>
              <Show when={row().hypothesis}>
                {(hypothesis) => (
                  <div class={lineItem}>
                    <div
                      class={css({
                        color: "zodiac.gold",
                        fontSize: "sm",
                        mb: "1",
                      })}
                    >
                      Hypothesis
                    </div>
                    <Link
                      to="/hypotheses/$hypothesisId"
                      params={{ hypothesisId: String(hypothesis()._id) }}
                      class={css({
                        color: "zodiac.cream",
                        textDecoration: "none",
                      })}
                    >
                      {hypothesis().title}
                    </Link>
                  </div>
                )}
              </Show>
              <Show when={row().thesis}>
                {(thesis) => (
                  <div class={lineItem}>
                    <div
                      class={css({
                        color: "zodiac.gold",
                        fontSize: "sm",
                        mb: "1",
                      })}
                    >
                      Thesis
                    </div>
                    <Link
                      to="/theses/$thesisId"
                      params={{ thesisId: String(thesis()._id) }}
                      class={css({
                        color: "zodiac.cream",
                        textDecoration: "none",
                      })}
                    >
                      {thesis().title}
                    </Link>
                  </div>
                )}
              </Show>
            </div>

            <Show when={row().sources.length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Linked Sources</div>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().sources}>
                  {(source) => (
                    <div class={lineItem}>
                      <div class={css({ color: "zodiac.cream" })}>
                        {source.title ?? "Untitled source"}
                      </div>
                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.55)",
                          fontSize: "sm",
                          mt: "1",
                        })}
                      >
                        {source.type}
                      </p>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={row().extractions.length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Extractions</div>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().extractions}>
                  {(extraction) => (
                    <div class={lineItem}>
                      <div class={css({ color: "zodiac.cream", mb: "1" })}>
                        {extraction.summary}
                      </div>
                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.55)",
                          fontSize: "sm",
                        })}
                      >
                        {extraction.claims.length} claims ·{" "}
                        {extraction.compositionParameters.length} parameters
                      </p>
                      <ExtractionCorrection extraction={extraction} />
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <hr class={goldDivider} />
            <div class={sectionLabel}>Listening History</div>
            <Show
              when={row().listeningSessions.length > 0}
              fallback={
                <p class={css({ color: "rgba(245, 240, 232, 0.58)" })}>
                  No listening sessions logged for this composition yet.
                </p>
              }
            >
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().listeningSessions}>
                  {(session) => (
                    <div class={lineItem}>
                      <div
                        class={css({
                          display: "flex",
                          gap: "2",
                          flexWrap: "wrap",
                          mb: "1",
                        })}
                      >
                        <Show when={session.expandVerdict}>
                          {(verdict) => (
                            <UIBadge tone="gold">{verdict()}</UIBadge>
                          )}
                        </Show>
                        <Show
                          when={session.ratings.expandability !== undefined}
                        >
                          {(score) => (
                            <UIBadge tone="cream">
                              expandability {score()}
                            </UIBadge>
                          )}
                        </Show>
                      </div>
                      <div
                        class={css({
                          color: "rgba(245, 240, 232, 0.7)",
                          lineHeight: "1.7",
                          marginBottom:
                            (session.feltQualities?.length ?? 0) > 0 ||
                            (session.bodyMapTags?.length ?? 0) > 0 ||
                            Boolean(session.bodyMapNotes) ||
                            (session.standoutMoments?.length ?? 0) > 0
                              ? "2"
                              : "0",
                        })}
                      >
                        <Markdown content={session.feedbackMd} />
                      </div>
                      <Show
                        when={
                          (session.feltQualities?.length ?? 0) > 0 ||
                          (session.bodyMapTags?.length ?? 0) > 0 ||
                          Boolean(session.bodyMapNotes)
                        }
                      >
                        <div
                          class={css({
                            color: "rgba(245, 240, 232, 0.62)",
                            fontSize: "sm",
                            lineHeight: "1.7",
                            marginBottom:
                              (session.standoutMoments?.length ?? 0) > 0
                                ? "2"
                                : "0",
                          })}
                        >
                          <Show when={(session.feltQualities?.length ?? 0) > 0}>
                            <p>Felt: {session.feltQualities?.join(", ")}</p>
                          </Show>
                          <Show when={(session.bodyMapTags?.length ?? 0) > 0}>
                            <p>Body map: {session.bodyMapTags?.join(", ")}</p>
                          </Show>
                          <Show when={session.bodyMapNotes}>
                            {(value) => <p>Body notes: {value()}</p>}
                          </Show>
                        </div>
                      </Show>
                      <Show when={(session.standoutMoments?.length ?? 0) > 0}>
                        <div
                          class={css({
                            color: "rgba(245, 240, 232, 0.58)",
                            fontSize: "sm",
                            lineHeight: "1.7",
                          })}
                        >
                          <p>Standout moments:</p>
                          <ul
                            class={css({
                              paddingLeft: "5",
                              listStyleType: "disc",
                            })}
                          >
                            <For each={session.standoutMoments}>
                              {(moment) => <li>{moment}</li>}
                            </For>
                          </ul>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </UICard>
        )}
      </Show>
    </section>
  );
}
