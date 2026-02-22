import { For, Show, createSignal } from "solid-js";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard, UIInput, UITextarea } from "../components/ui";
import { convexApi } from "../integrations/convex/api";
import {
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";

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

const fieldLabelClass = css({
  color: "rgba(245, 240, 232, 0.75)",
  display: "block",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  marginBottom: "1.5",
  textTransform: "uppercase",
});

export function HypothesesPage() {
  const hypotheses = createQueryWithStatus(convexApi.hypotheses.listByStatus, () => ({
    limit: 24,
  }));
  const recentSources = createQuery(convexApi.sources.listRecent, () => ({
    limit: 20,
  }));

  const createHypothesis = createMutation(convexApi.hypotheses.create);

  const [title, setTitle] = createSignal("");
  const [question, setQuestion] = createSignal("");
  const [statement, setStatement] = createSignal("");
  const [rationale, setRationale] = createSignal("");
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

    if (!title().trim() || !question().trim() || !statement().trim()) {
      setNotice("Title, question, and hypothesis statement are required.");
      return;
    }

    setNotice(null);

    try {
      await createHypothesis({
        title: title().trim(),
        question: question().trim(),
        hypothesis: statement().trim(),
        rationaleMd: rationale().trim() || "Draft rationale.",
        sourceIds: selectedSources().map((id) => id as any),
        concepts: [],
      });

      setTitle("");
      setQuestion("");
      setStatement("");
      setRationale("");
      setSelectedSources([]);
      setNotice("Hypothesis created.");
    } catch (error) {
      setNotice(`Failed to create hypothesis: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard as="form" onSubmit={submitHypothesis as any}>
        <h1 class={sectionTitleClass}>Hypotheses</h1>

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

        <label class={fieldLabelClass} for="hyp-rationale">
          Rationale
        </label>
        <UITextarea
          id="hyp-rationale"
          value={rationale()}
          onInput={(event) => setRationale(event.currentTarget.value)}
          placeholder="Reference extracted claims and why this is testable in one weekly turn."
        />

        <div class={css({ marginTop: "3" })}>
          <p class={fieldLabelClass}>Source Citations</p>
          <div class={css({ display: "grid", gap: "2", gridTemplateColumns: { base: "1fr", md: "repeat(2, minmax(0, 1fr))" } })}>
            <For each={recentSources() ?? []}>
              {(source: any) => (
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

        <div class={css({ display: "flex", justifyContent: "space-between", marginTop: "4" })}>
          <Show when={notice()}>
            {(message) => <p class={css({ color: "zodiac.cream" })}>{message()}</p>}
          </Show>
          <UIButton type="submit" variant="solid">
            Create Hypothesis
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Current Queue</h2>
        <Show when={!hypotheses.isLoading()} fallback={<p>Loading hypotheses…</p>}>
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={hypotheses.data() ?? []}>
              {(item: any) => (
                <div
                  data-testid="entity-row"
                  class={css({ borderColor: "rgba(200, 168, 75, 0.25)", borderRadius: "l2", borderWidth: "1px", p: "4" })}
                >
                  <div class={css({ display: "flex", gap: "2", marginBottom: "2" })}>
                    <UIBadge tone="cream">{item.status}</UIBadge>
                    <UIBadge tone="violet">{item.sourceIds.length} citations</UIBadge>
                  </div>
                  <h3 class={css({ fontSize: "xl", marginBottom: "1" })}>{item.title}</h3>
                  <p class={css({ color: "rgba(245, 240, 232, 0.7)", marginBottom: "1" })}>{item.question}</p>
                  <p class={css({ color: "rgba(245, 240, 232, 0.55)", fontSize: "sm" })}>{item.hypothesis}</p>
                </div>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
