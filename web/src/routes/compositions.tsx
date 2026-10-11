import { Link } from "@tanstack/solid-router";
import { createSignal, For, onMount, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { entityCardClass } from "../components/entity-card";
import {
  badgeRowClass,
  fieldLabelClass,
  helperClass,
  pageClass,
  pageTitleClass,
  recordLinkClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UIList,
  UINotice,
  UISelect,
} from "../components/ui";
import {
  createMutation,
  createQuery,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

type CompositionRow = {
  _id: string;
  status: string;
  artifactType: string;
  version: string;
  title: string;
  revisionParentId?: string;
  revisionVariable?: string;
};

const fieldGridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "repeat(2, minmax(0, 1fr))",
  },
  marginTop: "3",
});

const listClass = css({ display: "grid", gap: "3" });

const rowBadgesClass = cx(badgeRowClass, css({ marginBottom: "2" }));

const rowTitleClass = css({ fontSize: "xl", marginBottom: "2" });

const revisionOfClass = cx(helperClass, css({ mb: "2" }));

export function CompositionsPage() {
  onMount(() => {
    document.title = "Compositions — Frequency Music";
  });

  const compositions = createQueryWithStatus(api.compositions.list, () => ({
    limit: 24,
  }));
  const recipes = createQuery(api.recipes.listByStatus, () => ({
    limit: 40,
  }));

  const createComposition = createMutation(api.compositions.create);
  const updateComposition = createMutation(api.compositions.update);

  const [title, setTitle] = createSignal("");
  const [recipeId, setRecipeId] = createSignal("");
  const [artifactType, setArtifactType] = createSignal("microStudy");
  const [revisionParentId, setRevisionParentId] = createSignal("");
  const [revisionVariable, setRevisionVariable] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);

  async function submitComposition(event: SubmitEvent) {
    event.preventDefault();

    setNotice(null);
    setNoticeError(null);

    if (!title().trim() || !recipeId()) {
      setNoticeError("Title and recipe are required.");
      return;
    }
    if (revisionParentId().trim() && !revisionVariable().trim()) {
      setNoticeError("Changed Variable is required when this is a revision.");
      return;
    }

    try {
      await createComposition({
        title: title().trim(),
        recipeId: recipeId() as Id<"recipes">,
        artifactType: artifactType() as
          | "microStudy"
          | "expandedStudy"
          | "fullTrack",
        revisionParentId: revisionParentId().trim()
          ? (revisionParentId().trim() as Id<"compositions">)
          : undefined,
        revisionVariable: revisionVariable().trim() || undefined,
      });
      setTitle("");
      setRevisionParentId("");
      setRevisionVariable("");
      setNotice("Composition created.");
    } catch (error) {
      setNoticeError(`Failed to create composition: ${describeError(error)}`);
    }
  }

  async function setStatus(id: string, status: string) {
    setNotice(null);
    setNoticeError(null);
    try {
      await updateComposition({
        id: id as Id<"compositions">,
        status: status as "idea" | "in_progress" | "rendered" | "published",
      });
      setNotice(`Composition set to ${status}.`);
    } catch (error) {
      setNoticeError(`Status update failed: ${describeError(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Compositions</h1>
      </UICard>

      <UICard
        as="form"
        aria-labelledby="composition-form-heading"
        onSubmit={submitComposition}
      >
        <h2 id="composition-form-heading" class={sectionTitleClass}>
          New Composition
        </h2>

        <label class={fieldLabelClass} for="composition-title">
          Title
        </label>
        <UIInput
          id="composition-title"
          value={title()}
          onInput={(event) => setTitle(event.currentTarget.value)}
          placeholder="Drift Study A"
        />

        <div class={fieldGridClass}>
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

        <div class={fieldGridClass}>
          <div>
            <label class={fieldLabelClass} for="composition-revision-parent">
              Revision Of
            </label>
            <UISelect
              id="composition-revision-parent"
              value={revisionParentId()}
              onChange={(event) =>
                setRevisionParentId(event.currentTarget.value)
              }
            >
              <option value="">Original composition</option>
              <For each={compositions.data() ?? []}>
                {(item: CompositionRow) => (
                  <option value={String(item._id)}>
                    {item.title} ({item.version})
                  </option>
                )}
              </For>
            </UISelect>
          </div>

          <Show when={revisionParentId()}>
            <div>
              <label
                class={fieldLabelClass}
                for="composition-revision-variable"
              >
                Changed Variable
              </label>
              <UIInput
                id="composition-revision-variable"
                value={revisionVariable()}
                onInput={(event) =>
                  setRevisionVariable(event.currentTarget.value)
                }
                placeholder="tuning, tempo, timbre, rhythm density, voicing..."
              />
              <p class={cx(helperClass, css({ mt: "2" }))}>
                Name the one major variable this revision is testing: tuning,
                tempo, timbre, rhythm density, voicing, etc.
              </p>
            </div>
          </Show>
        </div>

        <div
          class={css({
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "3",
            justifyContent: "space-between",
            marginTop: "4",
          })}
        >
          <UINotice status={notice()} error={noticeError()} />
          <UIButton type="submit" variant="solid">
            Create Composition
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Artifact Pipeline</h2>
        <UINotice
          class={css({ textAlign: "center" })}
          status={
            compositions.isLoading()
              ? "Loading compositions…"
              : !compositions.isError() &&
                  (compositions.data() ?? []).length === 0
                ? "No compositions yet. Create one above to begin."
                : null
          }
          error={
            compositions.isError()
              ? `Unable to load compositions: ${compositions.error()?.message ?? "unknown error"}`
              : null
          }
        />
        <Show when={!compositions.isLoading()}>
          <Show when={(compositions.data() ?? []).length > 0}>
            <UIList class={listClass}>
              <For each={compositions.data() ?? []}>
                {(item: CompositionRow) => {
                  const revisionParent = () =>
                    (compositions.data() ?? []).find(
                      (candidate: { _id: string }) =>
                        String(candidate._id) === String(item.revisionParentId),
                    ) as { title: string } | undefined;

                  return (
                    <li data-testid="entity-row" class={entityCardClass}>
                      <div class={rowBadgesClass}>
                        <UIBadge tone="gold">{item.status}</UIBadge>
                        <UIBadge tone="violet">{item.artifactType}</UIBadge>
                        <UIBadge tone="cream">{item.version}</UIBadge>
                        <Show when={item.revisionVariable}>
                          <UIBadge tone="gold">
                            variable: {item.revisionVariable}
                          </UIBadge>
                        </Show>
                      </div>

                      <h3 class={rowTitleClass}>
                        <Link
                          to="/compositions/$compositionId"
                          params={{ compositionId: String(item._id) }}
                          class={recordLinkClass}
                        >
                          {item.title}
                        </Link>
                      </h3>

                      <Show when={item.revisionParentId}>
                        <p class={revisionOfClass}>
                          Revision of{" "}
                          {revisionParent()?.title ?? "an earlier composition"}
                        </p>
                      </Show>

                      <div class={badgeRowClass}>
                        <UIButton
                          variant="outline"
                          aria-pressed={item.status === "in_progress"}
                          aria-label={`Set ${item.title} to in progress`}
                          onClick={() =>
                            setStatus(String(item._id), "in_progress")
                          }
                        >
                          In Progress
                        </UIButton>
                        <UIButton
                          variant="outline"
                          aria-pressed={item.status === "rendered"}
                          aria-label={`Set ${item.title} to rendered`}
                          onClick={() =>
                            setStatus(String(item._id), "rendered")
                          }
                        >
                          Rendered
                        </UIButton>
                        <UIButton
                          variant="outline"
                          aria-pressed={item.status === "published"}
                          aria-label={`Set ${item.title} to published`}
                          onClick={() =>
                            setStatus(String(item._id), "published")
                          }
                        >
                          Published
                        </UIButton>
                      </div>
                    </li>
                  );
                }}
              </For>
            </UIList>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
