import { Link } from "@tanstack/solid-router";
import { createSignal, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
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
import { withDevBypassSecret } from "../integrations/authBypass";
import {
  createAction,
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

type HypothesisRow = { _id: string; title: string };
type RecipeRow = {
  _id: string;
  title: string;
  status: string;
  bodyMd: string;
  parameters: Array<{ type: string; value: string }>;
};

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
  onMount(() => { document.title = "Recipes — Frequency Music"; });

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
      {/* UICard's onSubmit prop typing doesn't align with submitRecipe's SubmitEvent signature in Solid. */}
      <UICard as="form" onSubmit={submitRecipe as any}>
        <h1 class={pageTitleClass}>Recipes</h1>

        <label class={fieldLabelClass} for="recipe-hypothesis">
          Hypothesis
        </label>
        <UISelect
          id="recipe-hypothesis"
          value={hypothesisId()}
          onChange={(event) => setHypothesisId(event.currentTarget.value)}
        >
          <option value="">Select hypothesis</option>
          <For each={hypotheses() ?? []}>
            {(item: HypothesisRow) => (
              <option value={String(item._id)}>{item.title}</option>
            )}
          </For>
        </UISelect>

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

        <div
          class={css({
            display: "grid",
            gap: "3",
            gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
          })}
        >
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
              placeholder={
                "Set tempo\nCreate bass and lead buses\nPrint version A"
              }
            />
          </div>
        </div>

        <div
          class={css({
            alignItems: "center",
            display: "flex",
            gap: "2",
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
          <Show
            when={(recipes.data() ?? []).length > 0}
            fallback={
              <p class={css({
                color: "rgba(245, 240, 232, 0.55)",
                fontFamily: "display",
                fontSize: "md",
                lineHeight: "1.6",
                textAlign: "center",
                py: "8",
              })}>
                No recipes yet. Generate one from a hypothesis to get started.
              </p>
            }
          >
            <div class={css({ display: "grid", gap: "3" })}>
              <For each={recipes.data() ?? []}>
                {(recipe: RecipeRow) => (
                  <Link
                    to={`/recipes/${recipe._id}`}
                    data-testid="entity-row"
                    class={css({
                      borderColor: "rgba(200, 168, 75, 0.25)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      cursor: "pointer",
                      display: "block",
                      p: "4",
                      textDecoration: "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      _hover: {
                        borderColor: "rgba(200, 168, 75, 0.5)",
                        boxShadow: "0 0 12px rgba(200, 168, 75, 0.08)",
                      },
                    })}
                  >
                    <div
                      class={css({
                        display: "flex",
                        gap: "2",
                        marginBottom: "2",
                      })}
                    >
                      <UIBadge tone="gold">{recipe.status}</UIBadge>
                      <UIBadge tone="violet">
                        {recipe.parameters.length} params
                      </UIBadge>
                    </div>
                    <h3 class={css({ fontSize: "xl", marginBottom: "2" })}>
                      {recipe.title}
                    </h3>
                    <p
                      class={css({
                        color: "rgba(245, 240, 232, 0.62)",
                        display: "-webkit-box",
                        fontSize: "sm",
                        overflow: "hidden",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 3,
                      })}
                    >
                      {recipe.bodyMd}
                    </p>
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
