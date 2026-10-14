import { Link } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc } from "../../../convex/_generated/dataModel";
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
  UITextarea,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

const listClass = css({ display: "grid", gap: "3" });

const rowBadgesClass = cx(badgeRowClass, css({ mb: "2" }));

const rowTitleClass = css({ color: "zodiac.cream", fontSize: "xl", mb: "2" });

const rowStatementClass = css({
  color: "zodiac.cream/66",
  lineHeight: "prose",
  maxW: "measure",
});

export function ThesesPage() {
  onMount(() => {
    document.title = "Theses — Frequency Music";
  });

  const theses = createQueryWithStatus(api.theses.list, () => ({
    limit: 100,
  }));
  const createThesis = createMutation(api.theses.create);
  const thesisRows = createMemo<Doc<"theses">[]>(
    () => (theses.data() ?? []) as Doc<"theses">[],
  );
  const [title, setTitle] = createSignal("");
  const [statement, setStatement] = createSignal("");
  const [descriptionMd, setDescriptionMd] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);

  const active = createMemo(() =>
    thesisRows().filter((thesis) => thesis.status === "active"),
  );
  const paused = createMemo(() =>
    thesisRows().filter((thesis) => thesis.status === "paused"),
  );
  const retired = createMemo(() =>
    thesisRows().filter((thesis) => thesis.status === "retired"),
  );

  function renderGroup(label: string, rows: Doc<"theses">[]) {
    const headingId = `theses-group-${label.toLowerCase()}`;
    return (
      <Show when={rows.length > 0}>
        <section aria-labelledby={headingId}>
          <h2 id={headingId} class={sectionTitleClass}>
            {label}
          </h2>
          <UIList class={listClass}>
            <For each={rows}>
              {(thesis) => (
                <li class={entityCardLinkClass}>
                  <div class={rowBadgesClass}>
                    <UIBadge tone="gold">{thesis.status}</UIBadge>
                    <UIBadge tone="cream">{thesis.visibility}</UIBadge>
                  </div>
                  <h3 class={rowTitleClass}>
                    <Link
                      to="/theses/$thesisId"
                      params={{ thesisId: String(thesis._id) }}
                      class={entityCardTitleLinkClass}
                    >
                      {thesis.title}
                    </Link>
                  </h3>
                  <p class={rowStatementClass}>{thesis.statement}</p>
                </li>
              )}
            </For>
          </UIList>
        </section>
      </Show>
    );
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    if (!title().trim() || !statement().trim()) {
      setNotice(null);
      setNoticeError("Title and statement are required.");
      return;
    }
    setNotice(null);
    setNoticeError(null);
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
      setNoticeError("Failed to create thesis. Please try again.");
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Theses</h1>
        <p class={helperClass}>
          Theses are the lightweight organizing questions that accumulate
          hypotheses, recipes, compositions, and reversals over time.
        </p>
      </UICard>

      <UICard
        as="form"
        aria-labelledby="thesis-form-heading"
        onSubmit={handleCreate}
      >
        <h2 id="thesis-form-heading" class={sectionTitleClass}>
          New Thesis
        </h2>

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
          <UINotice status={notice()} error={noticeError()} />
          <UIButton type="submit" variant="solid">
            Create Thesis
          </UIButton>
        </div>
      </UICard>

      <UINotice
        status={
          theses.isLoading()
            ? "Loading theses..."
            : !theses.isError() && thesisRows().length === 0
              ? "No theses yet."
              : null
        }
        error={
          theses.isError()
            ? `Unable to load theses: ${theses.error()?.message ?? "unknown error"}`
            : null
        }
      />

      <Show when={!theses.isLoading() && thesisRows().length > 0}>
        {renderGroup("Active", active())}
        {renderGroup("Paused", paused())}
        {renderGroup("Retired", retired())}
      </Show>
    </section>
  );
}
