import { For, Show, createSignal } from "solid-js";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard, UIInput, UITextarea } from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import { convexApi } from "../integrations/convex/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  createAction,
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

function parseParameters(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [type, ...rest] = line.split(":");
      return {
        type: type?.trim() || "custom",
        value: rest.join(":").trim() || line,
      };
    });
}

function parseChecklist(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function RecipesPage() {
  const hypotheses = createQuery(convexApi.hypotheses.listByStatus, () => ({
    limit: 30,
  }));
  const recipes = createQueryWithStatus(convexApi.recipes.listByStatus, () => ({
    limit: 30,
  }));

  const createRecipe = createMutation(convexApi.recipes.create);
  const generateFromHypothesis = createAction(
    convexApi.recipes.generateFromHypothesis,
  );

  const [hypothesisId, setHypothesisId] = createSignal("");
  const [title, setTitle] = createSignal("");
  const [bodyMd, setBodyMd] = createSignal("");
  const [parameters, setParameters] = createSignal("");
  const [checklist, setChecklist] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);

  async function submitRecipe(event: SubmitEvent) {
    event.preventDefault();

    if (!hypothesisId() || !title().trim() || !bodyMd().trim()) {
      setNotice("Hypothesis, title, and body are required.");
      return;
    }

    try {
      await createRecipe(
        withDevBypassSecret({
          hypothesisId: hypothesisId() as Id<"hypotheses">,
          title: title().trim(),
          bodyMd: bodyMd().trim(),
          parameters: parseParameters(parameters()),
          dawChecklist: parseChecklist(checklist()),
        }),
      );

      setTitle("");
      setBodyMd("");
      setParameters("");
      setChecklist("");
      setNotice("Recipe created.");
    } catch (error) {
      setNotice(`Failed to create recipe: ${String(error)}`);
    }
  }

  async function runAutoGenerate() {
    if (!hypothesisId()) {
      setNotice("Select a hypothesis first.");
      return;
    }

    try {
      await generateFromHypothesis(
        withDevBypassSecret({
          hypothesisId: hypothesisId() as Id<"hypotheses">,
        }),
      );
      setNotice("Auto recipe generation started.");
    } catch (error) {
      setNotice(`Auto generation failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard as="form" onSubmit={submitRecipe as any}>
        <h1 class={sectionTitleClass}>Recipes</h1>

        <label class={fieldLabelClass} for="recipe-hypothesis">
          Hypothesis
        </label>
        <select
          id="recipe-hypothesis"
          value={hypothesisId()}
          onChange={(event) => setHypothesisId(event.currentTarget.value)}
          class={css({
            bg: "rgba(26, 15, 53, 0.45)",
            borderColor: "rgba(200, 168, 75, 0.28)",
            borderRadius: "l2",
            borderWidth: "1px",
            color: "zodiac.cream",
            minH: "10",
            px: "3",
            width: "full",
          })}
        >
          <option value="">Select hypothesis</option>
          <For each={hypotheses() ?? []}>
            {(item: any) => <option value={String(item._id)}>{item.title}</option>}
          </For>
        </select>

        <label class={fieldLabelClass} for="recipe-title">
          Recipe Title
        </label>
        <UIInput
          id="recipe-title"
          value={title()}
          onInput={(event) => setTitle(event.currentTarget.value)}
          placeholder="16-bar harmonic drift study"
        />

        <label class={fieldLabelClass} for="recipe-body">
          Body (markdown)
        </label>
        <UITextarea
          id="recipe-body"
          value={bodyMd()}
          onInput={(event) => setBodyMd(event.currentTarget.value)}
          placeholder="Arrangement sketch and what to listen for..."
        />

        <div class={css({ display: "grid", gap: "3", gridTemplateColumns: { base: "1fr", md: "1fr 1fr" } })}>
          <div>
            <label class={fieldLabelClass} for="recipe-params">
              Parameters (one per line: type:value)
            </label>
            <UITextarea
              id="recipe-params"
              value={parameters()}
              onInput={(event) => setParameters(event.currentTarget.value)}
              placeholder={"tempo:108 BPM\ntuningSystem:12TET\nrootNote:C"}
            />
          </div>

          <div>
            <label class={fieldLabelClass} for="recipe-checklist">
              DAW Checklist (one per line)
            </label>
            <UITextarea
              id="recipe-checklist"
              value={checklist()}
              onInput={(event) => setChecklist(event.currentTarget.value)}
              placeholder={"Set tempo\nCreate bass and lead buses\nPrint version A"}
            />
          </div>
        </div>

        <div class={css({ alignItems: "center", display: "flex", gap: "2", justifyContent: "space-between", marginTop: "4" })}>
          <Show when={notice()}>
            {(message) => <p class={css({ color: "zodiac.cream" })}>{message()}</p>}
          </Show>
          <div class={css({ display: "flex", gap: "2" })}>
            <UIButton type="button" variant="outline" onClick={runAutoGenerate}>
              Auto Generate
            </UIButton>
            <UIButton type="submit" variant="solid">
              Create Recipe
            </UIButton>
          </div>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Recipe Library</h2>
        <Show when={!recipes.isLoading()} fallback={<p>Loading recipes…</p>}>
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={recipes.data() ?? []}>
              {(recipe: any) => (
                <div
                  data-testid="entity-row"
                  class={css({ borderColor: "rgba(200, 168, 75, 0.25)", borderRadius: "l2", borderWidth: "1px", p: "4" })}
                >
                  <div class={css({ display: "flex", gap: "2", marginBottom: "2" })}>
                    <UIBadge tone="gold">{recipe.status}</UIBadge>
                    <UIBadge tone="violet">{recipe.parameters.length} params</UIBadge>
                  </div>
                  <h3 class={css({ fontSize: "xl", marginBottom: "2" })}>{recipe.title}</h3>
                  <p class={css({ color: "rgba(245, 240, 232, 0.62)", fontSize: "sm", whiteSpace: "pre-wrap" })}>
                    {recipe.bodyMd}
                  </p>
                </div>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
