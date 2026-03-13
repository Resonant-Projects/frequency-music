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
} from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import {
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

export function CompositionsPage() {
  onMount(() => { document.title = "Compositions — Frequency Music"; });

  const compositions = createQueryWithStatus(
    convexApi.compositions.list,
    () => ({
      limit: 24,
    }),
  );
  const recipes = createQuery(convexApi.recipes.listByStatus, () => ({
    limit: 40,
  }));

  const createComposition = createMutation(convexApi.compositions.create);
  const updateComposition = createMutation(convexApi.compositions.update);

  const [title, setTitle] = createSignal("");
  const [recipeId, setRecipeId] = createSignal("");
  const [artifactType, setArtifactType] = createSignal("microStudy");
  const [notice, setNotice] = createSignal<string | null>(null);

  async function submitComposition(event: SubmitEvent) {
    event.preventDefault();

    if (!title().trim() || !recipeId()) {
      setNotice("Title and recipe are required.");
      return;
    }

    try {
      await createComposition(
        withDevBypassSecret({
          title: title().trim(),
          recipeId: recipeId() as Id<"recipes">,
          artifactType: artifactType() as
            | "microStudy"
            | "expandedStudy"
            | "fullTrack",
        }),
      );
      setTitle("");
      setNotice("Composition created.");
    } catch (error) {
      setNotice(`Failed to create composition: ${String(error)}`);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await updateComposition(
        withDevBypassSecret({
          id: id as Id<"compositions">,
          status: status as "idea" | "in_progress" | "rendered" | "published",
        }),
      );
      setNotice(`Composition set to ${status}.`);
    } catch (error) {
      setNotice(`Status update failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard as="form" onSubmit={submitComposition as any}>
        <h1 class={pageTitleClass}>Compositions</h1>

        <label class={fieldLabelClass} for="composition-title">
          Title
        </label>
        <UIInput
          id="composition-title"
          value={title()}
          onInput={(event) => setTitle(event.currentTarget.value)}
          placeholder="Drift Study A"
        />

        <div
          class={css({
            display: "grid",
            gap: "3",
            gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
            marginTop: "3",
          })}
        >
          <div>
            <label class={fieldLabelClass} for="composition-recipe">
              Recipe
            </label>
            <UISelect
              id="composition-recipe"
              value={recipeId()}
              onChange={(event) => setRecipeId(event.currentTarget.value)}
            >
              <option value="">Select recipe</option>
              <For each={recipes() ?? []}>
                {(recipe: { _id: string; title: string }) => (
                  <option value={String(recipe._id)}>{recipe.title}</option>
                )}
              </For>
            </UISelect>
          </div>

          <div>
            <label class={fieldLabelClass} for="composition-type">
              Artifact Type
            </label>
            <UISelect
              id="composition-type"
              value={artifactType()}
              onChange={(event) => setArtifactType(event.currentTarget.value)}
            >
              <option value="microStudy">microStudy</option>
              <option value="expandedStudy">expandedStudy</option>
              <option value="fullTrack">fullTrack</option>
            </UISelect>
          </div>
        </div>

        <div
          class={css({
            alignItems: "center",
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
            Create Composition
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Artifact Pipeline</h2>
        <Show
          when={!compositions.isLoading()}
          fallback={<p>Loading compositions…</p>}
        >
          <Show
            when={(compositions.data() ?? []).length > 0}
            fallback={
              <p class={css({
                color: "rgba(245, 240, 232, 0.55)",
                fontFamily: "display",
                fontSize: "md",
                lineHeight: "1.6",
                textAlign: "center",
                py: "8",
              })}>
                No compositions yet. Create one above to begin.
              </p>
            }
          >
            <div class={css({ display: "grid", gap: "3" })}>
              <For each={compositions.data() ?? []}>
                {(item: { _id: string; status: string; artifactType: string; version: string; title: string }) => (
                  <div
                    data-testid="entity-row"
                    class={css({
                      borderColor: "rgba(200, 168, 75, 0.22)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      p: "4",
                    })}
                  >
                    <div
                      class={css({
                        display: "flex",
                        gap: "2",
                        marginBottom: "2",
                      })}
                    >
                      <UIBadge tone="gold">{item.status}</UIBadge>
                      <UIBadge tone="violet">{item.artifactType}</UIBadge>
                      <UIBadge tone="cream">{item.version}</UIBadge>
                    </div>

                    <h3 class={css({ fontSize: "xl", marginBottom: "2" })}>
                      {item.title}
                    </h3>

                    <div
                      class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}
                    >
                      <UIButton
                        variant="outline"
                        onClick={() => setStatus(String(item._id), "in_progress")}
                      >
                        In Progress
                      </UIButton>
                      <UIButton
                        variant="outline"
                        onClick={() => setStatus(String(item._id), "rendered")}
                      >
                        Rendered
                      </UIButton>
                      <UIButton
                        variant="ghost"
                        onClick={() => setStatus(String(item._id), "published")}
                      >
                        Published
                      </UIButton>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
