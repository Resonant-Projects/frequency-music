import { Link } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc } from "../../../convex/_generated/dataModel";
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
  UISelect,
  UITextarea,
} from "../components/ui";
import {
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

function truncate(text: string, maxLength: number) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function HypothesesPage() {
  onMount(() => {
    document.title = "Hypotheses — Frequency Music";
  });

  const hypotheses = createQueryWithStatus(
    api.hypotheses.listByStatus,
    () => ({
      limit: 24,
    }),
  );
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
  const [selectedSources, setSelectedSources] = createSignal<string[]>([]);
  const [notice, setNotice] = createSignal<string | null>(null);

  function toggleSource(sourceId: string) {
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
      setNotice(
        "Title, question, hypothesis statement, and why this matters are required.",
      );
      return;
    }

    setNotice(null);

    try {
      await createHypothesis({
        title: title().trim(),
        question: question().trim(),
        hypothesis: statement().trim(),
        whyThisMatters: whyThisMatters().trim(),
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
      setNotice(`Failed to create hypothesis: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard as="form" onSubmit={submitHypothesis as any}>
        <h1 class={pageTitleClass}>Hypotheses</h1>

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

        <div class={css({ marginTop: "3" })}>
          <p class={fieldLabelClass}>Source Citations</p>
          <div
            class={css({
              display: "grid",
              gap: "2",
              gridTemplateColumns: {
                base: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
            })}
          >
            <For each={recentSourceRows()}>
              {(source) => (
                <label
                  class={css({
                    alignItems: "center",
                    borderColor: "rgba(200, 168, 75, 0.2)",
                    borderRadius: "l2",
                    borderWidth: "1px",
                    display: "flex",
                    gap: "2",
                    p: "2",
                  })}
                >
                  <input
                    type="checkbox"
                    checked={selectedSources().includes(String(source._id))}
                    onChange={() => toggleSource(String(source._id))}
                  />
                  <span class={css({ fontSize: "sm" })}>
                    {source.title ?? "Untitled source"}
                  </span>
                </label>
              )}
            </For>
          </div>
        </div>

        <div
          class={css({
            display: "flex",
            justifyContent: "space-between",
            marginTop: "4",
          })}
        >
          <div aria-live="polite">
            <Show when={notice()}>
              {(message) => (
                <p class={css({ color: "zodiac.cream" })}>{message()}</p>
              )}
            </Show>
          </div>
          <UIButton type="submit" variant="solid">
            Create Hypothesis
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Current Queue</h2>
        <Show
          when={!hypotheses.isLoading()}
          fallback={<p>Loading hypotheses…</p>}
        >
          <Show
            when={hypothesisRows().length > 0}
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
                No hypotheses yet. Generate one from an extraction or create one
                above.
              </p>
            }
          >
            <div class={css({ display: "grid", gap: "3" })}>
              <For each={hypothesisRows()}>
                {(item) => (
                  <Link
                    to={"/hypotheses/" + item._id}
                    style={{ "text-decoration": "none", color: "inherit" }}
                  >
                    <div
                      data-testid="entity-row"
                      class={css({
                        borderColor: "rgba(200, 168, 75, 0.25)",
                        borderRadius: "l2",
                        borderWidth: "1px",
                        cursor: "pointer",
                        p: "4",
                        transition: "border-color 0.2s",
                        _hover: {
                          borderColor: "rgba(200, 168, 75, 0.45)",
                        },
                      })}
                    >
                      <div
                        class={css({
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "2",
                          marginBottom: "2",
                        })}
                      >
                        <UIBadge tone="cream">{item.status}</UIBadge>
                        <UIBadge tone="violet">
                          {item.sourceIds.length} citations
                        </UIBadge>
                        <Show when={item.thesisId}>
                          <UIBadge tone="gold">linked thesis</UIBadge>
                        </Show>
                      </div>
                      <h3 class={css({ fontSize: "xl", marginBottom: "1" })}>
                        {item.title}
                      </h3>
                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.7)",
                          marginBottom: "1",
                        })}
                      >
                        {item.question}
                      </p>
                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.55)",
                          fontSize: "sm",
                        })}
                      >
                        {item.hypothesis}
                      </p>
                      <Show when={item.whyThisMatters}>
                        {(value) => (
                          <p
                            class={css({
                              color: "rgba(245, 240, 232, 0.48)",
                              fontSize: "sm",
                              marginTop: "2",
                            })}
                          >
                            Why this matters: {truncate(value(), 140)}
                          </p>
                        )}
                      </Show>
                    </div>
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
