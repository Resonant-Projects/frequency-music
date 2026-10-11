import { Link } from "@tanstack/solid-router";
import type { FunctionReturnType } from "convex/server";
import { createSignal, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  entityCardLinkClass,
  entityCardTitleLinkClass,
} from "../components/entity-card";
import {
  badgeRowClass,
  fieldLabelClass,
  helperClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UIList,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import {
  createAction,
  createMutation,
  createQuery,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";
import { stripMarkdown } from "../lib/essay-parse";
import { parseLines } from "../lib/markdown-utils";
import { api } from "../../../convex/_generated/api";

type HypothesisRow = { _id: string; title: string };
type RecipeRow = FunctionReturnType<typeof api.recipes.listByStatus>[number];

function parseParameters(input: string) {
  return parseLines(input).map((line) => {
    const [type, ...rest] = line.split(":");
    return {
      type: type?.trim() || "custom",
      value: rest.join(":").trim() || line,
    };
  });
}

/** Recipe cards add the gold discovery glow to the shared hover lift. */
const recipeCardClass = cx(
  entityCardLinkClass,
  css({ _hover: { boxShadow: "goldGlow" } }),
);

const listClass = css({ display: "grid", gap: "3" });

const rowBadgesClass = cx(badgeRowClass, css({ marginBottom: "2" }));

const rowTitleClass = css({ fontSize: "xl", marginBottom: "2" });

/** Three lines of the plain-text body. */
const bodyPreviewClass = cx(
  helperClass,
  css({ lineClamp: 3, overflow: "hidden" }),
);

const rowWhyClass = cx(helperClass, css({ marginTop: "2" }));

export function RecipesPage() {
  onMount(() => {
    document.title = "Recipes — Frequency Music";
  });

  const hypotheses = createQuery(api.hypotheses.listByStatus, () => ({
    limit: 30,
  }));
  const recipes = createQueryWithStatus(api.recipes.listByStatus, () => ({
    limit: 30,
  }));

  const createRecipe = createMutation(api.recipes.create);
  const generateFromHypothesis = createAction(
    api.recipes.generateFromHypothesis,
  );

  const [hypothesisId, setHypothesisId] = createSignal("");
  const [title, setTitle] = createSignal("");
  const [whyThisMatters, setWhyThisMatters] = createSignal("");
  const [bodyMd, setBodyMd] = createSignal("");
  const [parameters, setParameters] = createSignal("");
  const [checklist, setChecklist] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const [autoGenerating, setAutoGenerating] = createSignal(false);

  async function submitRecipe(event: SubmitEvent) {
    event.preventDefault();

    if (
      !hypothesisId() ||
      !title().trim() ||
      !whyThisMatters().trim() ||
      !bodyMd().trim()
    ) {
      setNotice(null);
      setNoticeError(
        "Hypothesis, title, why this matters, and body are required.",
      );
      return;
    }

    try {
      setNotice(null);
      setNoticeError(null);
      await createRecipe({
        hypothesisId: hypothesisId() as Id<"hypotheses">,
        title: title().trim(),
        whyThisMatters: whyThisMatters().trim(),
        bodyMd: bodyMd().trim(),
        parameters: parseParameters(parameters()),
        dawChecklist: parseLines(checklist()),
      });

      setTitle("");
      setWhyThisMatters("");
      setBodyMd("");
      setParameters("");
      setChecklist("");
      setNotice("Recipe created.");
    } catch (error) {
      setNoticeError(`Failed to create recipe: ${describeError(error)}`);
    }
  }

  async function runAutoGenerate() {
    if (!hypothesisId()) {
      setNotice(null);
      setNoticeError("Select a hypothesis first.");
      return;
    }

    if (autoGenerating()) return;
    setAutoGenerating(true);
    setNotice(null);
    setNoticeError(null);
    try {
      await generateFromHypothesis({
        hypothesisId: hypothesisId() as Id<"hypotheses">,
      });
      setNotice("Auto recipe generation started.");
    } catch (error) {
      setNoticeError(`Auto generation failed: ${describeError(error)}`);
    } finally {
      setAutoGenerating(false);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Recipes</h1>
      </UICard>

      <UICard
        as="form"
        aria-labelledby="recipe-form-heading"
        onSubmit={submitRecipe}
      >
        <h2 id="recipe-form-heading" class={sectionTitleClass}>
          New Recipe
        </h2>

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

        <label class={fieldLabelClass} for="recipe-why">
          Why This Matters
        </label>
        <UITextarea
          id="recipe-why"
          value={whyThisMatters()}
          onInput={(event) => setWhyThisMatters(event.currentTarget.value)}
          placeholder="What is this recipe trying to reveal musically, perceptually, or compositionally?"
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
            gridTemplateColumns: {
              base: "minmax(0, 1fr)",
              md: "repeat(2, minmax(0, 1fr))",
            },
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
            flexWrap: "wrap",
            gap: "2",
            justifyContent: "space-between",
            marginTop: "4",
          })}
        >
          <UINotice status={notice()} error={noticeError()} />
          <div class={css({ display: "flex", gap: "2" })}>
            <UIButton
              type="button"
              variant="outline"
              aria-busy={autoGenerating()}
              onClick={runAutoGenerate}
            >
              {autoGenerating() ? "Generating…" : "Auto Generate"}
            </UIButton>
            <UIButton type="submit" variant="solid">
              Create Recipe
            </UIButton>
          </div>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Recipe Library</h2>
        <UINotice
          class={css({ textAlign: "center" })}
          status={
            recipes.isLoading()
              ? "Loading recipes…"
              : !recipes.isError() && (recipes.data() ?? []).length === 0
                ? "No recipes yet. Generate one from a hypothesis to get started."
                : null
          }
          error={
            recipes.isError()
              ? `Unable to load recipes: ${recipes.error()?.message ?? "unknown error"}`
              : null
          }
        />
        <Show when={!recipes.isLoading()}>
          <Show when={(recipes.data() ?? []).length > 0}>
            <UIList class={listClass}>
              <For each={recipes.data() ?? []}>
                {(recipe: RecipeRow) => (
                  <li data-testid="entity-row" class={recipeCardClass}>
                    <div class={rowBadgesClass}>
                      <UIBadge tone="gold">{recipe.status}</UIBadge>
                      <UIBadge tone="cream">
                        {recipe.parameters.length} params
                      </UIBadge>
                    </div>
                    <h3 class={rowTitleClass}>
                      <Link
                        to="/recipes/$recipeId"
                        params={{ recipeId: recipe._id }}
                        class={entityCardTitleLinkClass}
                      >
                        {recipe.title}
                      </Link>
                    </h3>
                    <p class={bodyPreviewClass}>
                      {stripMarkdown(recipe.bodyMd)}
                    </p>
                    <Show when={recipe.whyThisMatters}>
                      {(value) => (
                        <p class={rowWhyClass}>Why this matters: {value()}</p>
                      )}
                    </Show>
                  </li>
                )}
              </For>
            </UIList>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
