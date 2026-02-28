import { For, Show, createSignal } from "solid-js";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard, UIInput } from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
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

export function CompositionsPage() {
  const compositions = createQueryWithStatus(convexApi.compositions.list, () => ({
    limit: 24,
  }));
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
          recipeId: recipeId() as any,
          artifactType: artifactType() as any,
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
        withDevBypassSecret({ id: id as any, status: status as any }),
      );
      setNotice(`Composition set to ${status}.`);
    } catch (error) {
      setNotice(`Status update failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard as="form" onSubmit={submitComposition as any}>
        <h1 class={sectionTitleClass}>Compositions</h1>

        <label class={fieldLabelClass} for="composition-title">
          Title
        </label>
        <UIInput
          id="composition-title"
          value={title()}
          onInput={(event) => setTitle(event.currentTarget.value)}
          placeholder="Drift Study A"
        />

        <div class={css({ display: "grid", gap: "3", gridTemplateColumns: { base: "1fr", md: "1fr 1fr" }, marginTop: "3" })}>
          <div>
            <label class={fieldLabelClass} for="composition-recipe">
              Recipe
            </label>
            <select
              id="composition-recipe"
              value={recipeId()}
              onChange={(event) => setRecipeId(event.currentTarget.value)}
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
              <option value="">Select recipe</option>
              <For each={recipes() ?? []}>
                {(recipe: any) => (
                  <option value={String(recipe._id)}>{recipe.title}</option>
                )}
              </For>
            </select>
          </div>

          <div>
            <label class={fieldLabelClass} for="composition-type">
              Artifact Type
            </label>
            <select
              id="composition-type"
              value={artifactType()}
              onChange={(event) => setArtifactType(event.currentTarget.value)}
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
              <option value="microStudy">microStudy</option>
              <option value="expandedStudy">expandedStudy</option>
              <option value="fullTrack">fullTrack</option>
            </select>
          </div>
        </div>

        <div class={css({ alignItems: "center", display: "flex", justifyContent: "space-between", marginTop: "4" })}>
          <Show when={notice()}>
            {(message) => <p class={css({ color: "zodiac.cream" })}>{message()}</p>}
          </Show>
          <UIButton type="submit" variant="solid">
            Create Composition
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Artifact Pipeline</h2>
        <Show when={!compositions.isLoading()} fallback={<p>Loading compositions…</p>}>
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={compositions.data() ?? []}>
              {(item: any) => (
                <div
                  data-testid="entity-row"
                  class={css({ borderColor: "rgba(200, 168, 75, 0.22)", borderRadius: "l2", borderWidth: "1px", p: "4" })}
                >
                  <div class={css({ display: "flex", gap: "2", marginBottom: "2" })}>
                    <UIBadge tone="gold">{item.status}</UIBadge>
                    <UIBadge tone="violet">{item.artifactType}</UIBadge>
                    <UIBadge tone="cream">{item.version}</UIBadge>
                  </div>

                  <h3 class={css({ fontSize: "xl", marginBottom: "2" })}>{item.title}</h3>

                  <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
                    <UIButton variant="outline" onClick={() => setStatus(String(item._id), "in_progress")}>
                      In Progress
                    </UIButton>
                    <UIButton variant="outline" onClick={() => setStatus(String(item._id), "rendered")}>
                      Rendered
                    </UIButton>
                    <UIButton variant="ghost" onClick={() => setStatus(String(item._id), "published")}>
                      Published
                    </UIButton>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
