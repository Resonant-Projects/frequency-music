import { Link } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  fieldLabelClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import {
  entityCardLinkClass,
  entityCardTitleLinkClass,
} from "../components/entity-card";
import {
  createMutation,
  createQuery,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

function truncate(text: string, maxLength: number) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function HypothesesPage() {
  onMount(() => {
    document.title = "Hypotheses — Frequency Music";
  });

  const hypotheses = createQueryWithStatus(api.hypotheses.listByStatus, () => ({
    limit: 24,
  }));
  const recentSources = createQuery(api.sources.listRecent, () => ({
    limit: 20,
  }));
  const activeTheses = createQuery(api.theses.list, () => ({
    status: "active" as const,
    limit: 50,
  }));
  const recentSourceRows = createMemo<Doc<"sources">[]>(
    () => (recentSources() ?? []) as Doc<"sources">[],
  );
  const thesisRows = createMemo<Doc<"theses">[]>(
    () => (activeTheses() ?? []) as Doc<"theses">[],
  );
  const hypothesisRows = createMemo<Doc<"hypotheses">[]>(
    () => (hypotheses.data() ?? []) as Doc<"hypotheses">[],
  );

  const createHypothesis = createMutation(api.hypotheses.create);

  const [title, setTitle] = createSignal("");
  const [question, setQuestion] = createSignal("");
  const [statement, setStatement] = createSignal("");
  const [whyThisMatters, setWhyThisMatters] = createSignal("");
  const [rationale, setRationale] = createSignal("");
  const [thesisId, setThesisId] = createSignal("");
  const [selectedSources, setSelectedSources] = createSignal<Id<"sources">[]>(
    [],
  );
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);

  function toggleSource(sourceId: Id<"sources">) {
    setSelectedSources((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId],
    );
  }

  async function submitHypothesis(event: SubmitEvent) {
    event.preventDefault();

    if (
      !title().trim() ||
      !question().trim() ||
      !statement().trim() ||
      !whyThisMatters().trim()
    ) {
      setNotice(null);
      setNoticeError(
        "Title, question, hypothesis statement, and why this matters are required.",
      );
      return;
    }

    setNotice(null);
    setNoticeError(null);

    try {
      await createHypothesis({
        title: title().trim(),
        question: question().trim(),
        hypothesis: statement().trim(),
        whyThisMatters: whyThisMatters().trim(),
        // `hypotheses.create` requires `rationaleMd` (a `v.string()`, and the
        // fallback for `whyThisMatters`), so a blank field keeps the stub.
        rationaleMd: rationale().trim() || "Draft rationale.",
        thesisId: thesisId().trim()
          ? (thesisId().trim() as Doc<"theses">["_id"])
          : undefined,
        sourceIds: selectedSources(),
        concepts: [],
      });

      setTitle("");
      setQuestion("");
      setStatement("");
      setWhyThisMatters("");
      setRationale("");
      setThesisId("");
      setSelectedSources([]);
      setNotice("Hypothesis created.");
    } catch (error) {
      setNoticeError(`Failed to create hypothesis: ${describeError(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Hypotheses</h1>
      </UICard>

      <UICard
        as="form"
        aria-labelledby="hyp-form-heading"
        onSubmit={submitHypothesis}
      >
        <h2 id="hyp-form-heading" class={sectionTitleClass}>
          New Hypothesis
        </h2>

        <label class={fieldLabelClass} for="hyp-title">
          Title
        </label>
        <UIInput
          id="hyp-title"
          value={title()}
          onInput={(event) => setTitle(event.currentTarget.value)}
          placeholder="Integer interval lattices and perceived grounding"
        />

        <label class={fieldLabelClass} for="hyp-question">
          Question
        </label>
        <UIInput
          id="hyp-question"
          value={question()}
          onInput={(event) => setQuestion(event.currentTarget.value)}
          placeholder="Does emphasizing low-integer ratio drift increase pleasantness?"
        />

        <label class={fieldLabelClass} for="hyp-statement">
          Hypothesis
        </label>
        <UITextarea
          id="hyp-statement"
          value={statement()}
          onInput={(event) => setStatement(event.currentTarget.value)}
          placeholder="If we maintain stable fifth anchors while modulating upper partial clusters..."
        />

        <label class={fieldLabelClass} for="hyp-why">
          Why This Matters
        </label>
        <UITextarea
          id="hyp-why"
          value={whyThisMatters()}
          onInput={(event) => setWhyThisMatters(event.currentTarget.value)}
          placeholder="Why does this deserve studio time? What would change in the music if it proves useful?"
        />

        <label class={fieldLabelClass} for="hyp-rationale">
          Rationale
        </label>
        <UITextarea
          id="hyp-rationale"
          value={rationale()}
          onInput={(event) => setRationale(event.currentTarget.value)}
          placeholder="Reference extracted claims and why this is testable in one weekly turn."
        />

        <label class={fieldLabelClass} for="hyp-thesis">
          Thesis
        </label>
        <UISelect
          id="hyp-thesis"
          value={thesisId()}
          onChange={(event) => setThesisId(event.currentTarget.value)}
        >
          <option value="">No thesis yet</option>
          <For each={thesisRows()}>
            {(thesis) => (
              <option value={String(thesis._id)}>{thesis.title}</option>
            )}
          </For>
        </UISelect>

        <fieldset
          class={css({
            border: "none",
            margin: "0",
            marginTop: "3",
            minWidth: "0",
            padding: "0",
          })}
        >
          <legend class={fieldLabelClass}>Source Citations</legend>
          <div
            class={css({
              display: "grid",
              gap: "2",
              gridTemplateColumns: {
                base: "minmax(0, 1fr)",
                md: "repeat(2, minmax(0, 1fr))",
              },
            })}
          >
            <For each={recentSourceRows()}>
              {(source) => (
                <label
                  class={css({
                    alignItems: "center",
                    borderColor: "zodiac.gold/20",
                    borderRadius: "l2",
                    borderWidth: "1px",
                    cursor: "pointer",
                    display: "flex",
                    gap: "2",
                    p: "2",
                    _coarsePointer: { minH: "11" },
                  })}
                >
                  <input
                    type="checkbox"
                    class={css({
                      accentColor: "zodiac.gold",
                      flexShrink: 0,
                      _focusVisible: {
                        outline: "2px solid",
                        outlineColor: "zodiac.gold",
                        outlineOffset: "2px",
                      },
                    })}
                    checked={selectedSources().includes(source._id)}
                    onChange={() => toggleSource(source._id)}
                  />
                  <span class={css({ fontSize: "sm" })}>
                    {source.title ?? "Untitled source"}
                  </span>
                </label>
              )}
            </For>
          </div>
        </fieldset>

        <div
          class={css({
            display: "flex",
            flexWrap: "wrap",
            gap: "3",
            justifyContent: "space-between",
            marginTop: "4",
          })}
        >
          <UINotice status={notice()} error={noticeError()} />
          <UIButton type="submit" variant="solid">
            Create Hypothesis
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Current Queue</h2>
        <UINotice
          class={css({ textAlign: "center" })}
          status={
            hypotheses.isLoading()
              ? "Loading hypotheses…"
              : !hypotheses.error() && hypothesisRows().length === 0
                ? "No hypotheses yet. Generate one from an extraction or create one above."
                : null
          }
          error={
            hypotheses.error()
              ? `Unable to load hypotheses: ${hypotheses.error()?.message}`
              : null
          }
        />
        <Show when={!hypotheses.isLoading()}>
          <Show when={hypothesisRows().length > 0}>
            <ul
              role="list"
              class={css({ display: "grid", gap: "3", listStyle: "none" })}
            >
              <For each={hypothesisRows()}>
                {(item) => (
                  <li data-testid="entity-row" class={entityCardLinkClass}>
                    <div
                      class={css({
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2",
                        marginBottom: "2",
                      })}
                    >
                      <UIBadge tone="gold">{item.status}</UIBadge>
                      <UIBadge tone="cream">
                        {item.sourceIds.length} citations
                      </UIBadge>
                      <Show when={item.thesisId}>
                        <UIBadge tone="gold">linked thesis</UIBadge>
                      </Show>
                    </div>
                    <h3 class={css({ fontSize: "xl", marginBottom: "1" })}>
                      <Link
                        to="/hypotheses/$hypothesisId"
                        params={{ hypothesisId: String(item._id) }}
                        class={entityCardTitleLinkClass}
                      >
                        {item.title}
                      </Link>
                    </h3>
                    <p
                      class={css({
                        color: "zodiac.cream/70",
                        marginBottom: "1",
                        maxW: "72ch",
                      })}
                    >
                      {item.question}
                    </p>
                    <p
                      class={css({
                        color: "zodiac.cream/66",
                        fontSize: "sm",
                        maxW: "72ch",
                      })}
                    >
                      {item.hypothesis}
                    </p>
                    <Show when={item.whyThisMatters}>
                      {(value) => (
                        <p
                          class={css({
                            color: "zodiac.cream/66",
                            fontSize: "sm",
                            marginTop: "2",
                            maxW: "72ch",
                          })}
                        >
                          Why this matters: {truncate(value(), 140)}
                        </p>
                      )}
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
