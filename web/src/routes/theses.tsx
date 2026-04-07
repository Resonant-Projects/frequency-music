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
  UITextarea,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const thesisCard = css({
  borderColor: "rgba(200, 168, 75, 0.22)",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "block",
  p: "4",
  textDecoration: "none",
  transition: "border-color 0.15s",
  _hover: {
    borderColor: "rgba(200, 168, 75, 0.45)",
  },
});

export function ThesesPage() {
  onMount(() => {
    document.title = "Theses — Frequency Music";
  });

  const theses = createQueryWithStatus(convexApi.theses.list, () => ({
    limit: 100,
  }));
  const createThesis = createMutation(convexApi.theses.create);
  const thesisRows = createMemo<Doc<"theses">[]>(() => (theses.data() ?? []) as Doc<"theses">[]);
  const [title, setTitle] = createSignal("");
  const [statement, setStatement] = createSignal("");
  const [descriptionMd, setDescriptionMd] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);

  const active = createMemo(() => thesisRows().filter((thesis) => thesis.status === "active"));
  const paused = createMemo(() => thesisRows().filter((thesis) => thesis.status === "paused"));
  const retired = createMemo(() => thesisRows().filter((thesis) => thesis.status === "retired"));

  function renderGroup(label: string, rows: Doc<"theses">[]) {
    return (
      <Show when={rows.length > 0}>
        <section>
          <h2 class={sectionTitleClass}>{label}</h2>
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={rows}>
              {(thesis) => (
                <Link
                  to="/theses/$thesisId"
                  params={{ thesisId: String(thesis._id) }}
                  class={thesisCard}
                >
                  <div class={css({ display: "flex", gap: "2", mb: "2" })}>
                    <UIBadge tone="gold">{thesis.status}</UIBadge>
                    <UIBadge tone="cream">{thesis.visibility}</UIBadge>
                  </div>
                  <h3
                    class={css({
                      color: "zodiac.cream",
                      fontSize: "xl",
                      mb: "2",
                    })}
                  >
                    {thesis.title}
                  </h3>
                  <p
                    class={css({
                      color: "rgba(245, 240, 232, 0.66)",
                      lineHeight: "1.7",
                    })}
                  >
                    {thesis.statement}
                  </p>
                </Link>
              )}
            </For>
          </div>
        </section>
      </Show>
    );
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!title().trim() || !statement().trim()) {
      setNotice("Title and statement are required.");
      return;
    }
    try {
      await createThesis({
        title: title().trim(),
        statement: statement().trim(),
        descriptionMd: descriptionMd().trim() || undefined,
      });
      setTitle("");
      setStatement("");
      setDescriptionMd("");
      setNotice("Thesis created.");
    } catch (error) {
      console.error("Failed to create thesis:", error);
      setNotice("Failed to create thesis. Please try again.");
    }
  }

  return (
    <section class={pageClass}>
      <UICard as="form" onSubmit={handleCreate as any}>
        <h1 class={pageTitleClass}>Theses</h1>
        <p class={css({ color: "rgba(245, 240, 232, 0.62)", lineHeight: "1.6" })}>
          Theses are the lightweight organizing questions that accumulate hypotheses, recipes,
          compositions, and reversals over time.
        </p>

        <label class={fieldLabelClass} for="thesis-title">
          Title
        </label>
        <UIInput
          id="thesis-title"
          value={title()}
          onInput={(event) => setTitle(event.currentTarget.value)}
          placeholder="Symmetry as a compositional constraint"
        />

        <label class={fieldLabelClass} for="thesis-statement">
          Statement
        </label>
        <UITextarea
          id="thesis-statement"
          value={statement()}
          onInput={(event) => setStatement(event.currentTarget.value)}
          placeholder="A concise thesis statement that can accumulate many weekly turns."
        />

        <label class={fieldLabelClass} for="thesis-description">
          Description
        </label>
        <UITextarea
          id="thesis-description"
          value={descriptionMd()}
          onInput={(event) => setDescriptionMd(event.currentTarget.value)}
          placeholder="Optional longer framing."
        />

        <div
          class={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "3",
            marginTop: "4",
            flexWrap: "wrap",
          })}
        >
          <Show when={notice()}>
            {(message) => <p class={css({ color: "zodiac.cream" })}>{message()}</p>}
          </Show>
          <UIButton type="submit" variant="outline">
            Create Thesis
          </UIButton>
        </div>
      </UICard>

      <Show
        when={!theses.isLoading() && thesisRows().length > 0}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>
              {theses.isLoading() ? "Loading theses..." : "No theses yet."}
            </p>
          </UICard>
        }
      >
        {renderGroup("Active", active())}
        {renderGroup("Paused", paused())}
        {renderGroup("Retired", retired())}
      </Show>
    </section>
  );
}
