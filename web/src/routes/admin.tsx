import { Link } from "@tanstack/solid-router";
import {
  type ComponentProps,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { SOURCE_STATUSES } from "../../../convex/shared/statuses";
import { css, cx } from "../../styled-system/css";
import {
  badgeRowClass,
  fieldLabelClass,
  formActionsClass,
  helperClass,
  inlineActionLink,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UINotice,
  UISelect,
} from "../components/ui";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";

type SourceStatus = FunctionArgs<typeof api.admin.setSourceStatus>["status"];
type BadgeTone = NonNullable<ComponentProps<typeof UIBadge>["tone"]>;
type Snapshot = FunctionReturnType<typeof api.admin.workspaceSnapshot>;
type ReviewSummary = FunctionReturnType<typeof api.vocabulary.reviewSummary>;

const SNAPSHOT_COUNTS: Array<
  [label: string, tone: BadgeTone, key: keyof Snapshot]
> = [
  ["Sources", "gold", "sources"],
  ["Hypotheses", "violet", "hypotheses"],
  ["Recipes", "cream", "recipes"],
  ["Compositions", "gold", "compositions"],
  ["Weekly Briefs", "violet", "weeklyBriefs"],
  ["Feeds", "cream", "feeds"],
];

const PROVISIONAL_TERMS: Array<
  [label: string, tone: BadgeTone, key: keyof ReviewSummary]
> = [
  ["Parameter Kinds", "gold", "provisionalParameterKinds"],
  ["Concept Domains", "violet", "provisionalConceptDomains"],
  ["Relationship Kinds", "cream", "provisionalRelationshipKinds"],
];

const SOURCE_ID_REQUIRED = "Source ID is required.";

const countClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: "2xl",
  mt: "2",
});

const snapshotGridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "repeat(2, minmax(0, 1fr))",
    md: "repeat(3, minmax(0, 1fr))",
  },
});

const termsRowClass = cx(badgeRowClass, css({ mt: "2" }));

const actionsRowClass = cx(formActionsClass, css({ mt: "3" }));

export function AdminPage() {
  onMount(() => {
    document.title = "Admin — Frequency Music";
  });

  const snapshot = createQueryWithStatus(api.admin.workspaceSnapshot);
  const setSourceStatus = createMutation(api.admin.setSourceStatus);
  const startBatchExtraction = createMutation(
    api.workflows.startBatchExtraction,
  );
  const reviewSummary = createQueryWithStatus(api.vocabulary.reviewSummary);

  const [sourceId, setSourceId] = createSignal("");
  const [sourceStatus, setSourceStatusValue] =
    createSignal<SourceStatus>("review_needed");
  const [batchLimit, setBatchLimit] = createSignal("25");
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const [sourceIdInvalid, setSourceIdInvalid] = createSignal(false);
  const [isQueueing, setIsQueueing] = createSignal(false);
  const [isApplying, setIsApplying] = createSignal(false);
  let sourceIdField: HTMLInputElement | undefined;

  /** A snapshot count, or an em dash until the snapshot has loaded. */
  const count = (key: keyof Snapshot) => snapshot.data()?.[key] ?? "—";

  async function submitSourceStatus(event: SubmitEvent) {
    event.preventDefault();
    if (isApplying()) return;
    setNotice(null);
    setNoticeError(null);

    if (!sourceId().trim()) {
      setSourceIdInvalid(true);
      // Enter-to-submit never leaves the field, so its error text alone would
      // go unannounced; the page alert carries it too.
      setNoticeError(SOURCE_ID_REQUIRED);
      sourceIdField?.focus();
      return;
    }
    setSourceIdInvalid(false);

    setIsApplying(true);
    try {
      await setSourceStatus({
        id: sourceId().trim() as Id<"sources">,
        status: sourceStatus(),
      });
      setNotice("Source status updated.");
    } catch (error) {
      setNoticeError(`Source status update failed: ${describeError(error)}`);
    } finally {
      setIsApplying(false);
    }
  }

  async function queueBatchExtraction(event: SubmitEvent) {
    event.preventDefault();
    if (isQueueing()) return;
    setNotice(null);
    setNoticeError(null);

    setIsQueueing(true);
    try {
      const result = await startBatchExtraction({
        limit: Number(batchLimit()) || 25,
      });
      setNotice(`Batch extraction queued: ${result.workflowId}`);
    } catch (error) {
      setNoticeError(`Batch extraction failed: ${describeError(error)}`);
    } finally {
      setIsQueueing(false);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Admin</h1>
        <p class={helperClass}>
          Workspace metrics and emergency operational overrides.
        </p>

        <UINotice
          class={css({ marginTop: "3" })}
          status={notice()}
          error={noticeError()}
        />
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Workspace Snapshot</h2>
        <UINotice
          status={snapshot.isLoading() ? "Loading workspace snapshot…" : null}
          error={
            snapshot.error()
              ? `Unable to load workspace snapshot: ${snapshot.error()?.message}`
              : null
          }
        />
        <dl class={snapshotGridClass}>
          <For each={SNAPSHOT_COUNTS}>
            {([label, tone, key]) => (
              <div>
                <dt>
                  <UIBadge tone={tone}>{label}</UIBadge>
                </dt>
                <dd class={countClass}>{count(key)}</dd>
              </div>
            )}
          </For>
        </dl>
      </UICard>

      <UICard
        as="form"
        onSubmit={queueBatchExtraction}
        aria-busy={isQueueing()}
      >
        <h2 class={sectionTitleClass}>Extraction Backlog</h2>
        <p class={helperClass}>
          Queue extraction for existing `text_ready` sources so they can create
          concepts and link into the graph.
        </p>
        <label class={fieldLabelClass} for="admin-batch-limit">
          Batch Size
        </label>
        <UIInput
          id="admin-batch-limit"
          inputmode="numeric"
          value={batchLimit()}
          onInput={(event) => setBatchLimit(event.currentTarget.value)}
          placeholder="25"
        />
        <div class={actionsRowClass}>
          <UIButton type="submit" variant="solid" aria-busy={isQueueing()}>
            Queue Batch Extraction
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Vocabulary Review</h2>
        <p class={helperClass}>
          New parameter kinds, concept domains, and edge relationships are
          stored provisionally instead of blocking extraction.
        </p>
        <UINotice
          status={
            reviewSummary.isLoading() ? "Loading vocabulary review…" : null
          }
          error={
            reviewSummary.error()
              ? `Unable to load vocabulary review: ${reviewSummary.error()?.message}`
              : null
          }
        />
        <div class={css({ display: "grid", gap: "4", marginTop: "3" })}>
          <For each={PROVISIONAL_TERMS}>
            {([label, tone, key]) => (
              <div>
                <UIBadge tone={tone}>{label}</UIBadge>
                <div class={termsRowClass}>
                  <ProvisionalTerms terms={reviewSummary.data()?.[key]} />
                </div>
              </div>
            )}
          </For>
        </div>
      </UICard>

      <UICard as="form" onSubmit={submitSourceStatus} aria-busy={isApplying()}>
        <h2 class={sectionTitleClass}>Source Override</h2>
        <p class={cx(helperClass, css({ marginBottom: "3" }))}>
          Emergency/manual override. For normal source workflow, use the Display
          queue.
        </p>
        <p class={css({ marginBottom: "3" })}>
          <Link to="/display" class={inlineActionLink}>
            Open Display Queue <span aria-hidden="true">→</span>
          </Link>
        </p>
        <label class={fieldLabelClass} for="admin-source-id">
          Source ID
        </label>
        <UIInput
          ref={(element) => {
            sourceIdField = element;
          }}
          id="admin-source-id"
          value={sourceId()}
          aria-invalid={sourceIdInvalid() ? "true" : undefined}
          aria-describedby={
            sourceIdInvalid() ? "admin-source-id-error" : undefined
          }
          onInput={(event) => {
            setSourceId(event.currentTarget.value);
            if (sourceIdInvalid()) setSourceIdInvalid(false);
          }}
          placeholder="k57..."
        />
        <Show when={sourceIdInvalid()}>
          <p
            id="admin-source-id-error"
            class={css({ color: "zodiac.error", fontSize: "sm", mt: "1" })}
          >
            {SOURCE_ID_REQUIRED}
          </p>
        </Show>

        <label class={fieldLabelClass} for="admin-source-status">
          Status
        </label>
        <UISelect
          id="admin-source-status"
          value={sourceStatus()}
          onChange={(event) =>
            setSourceStatusValue(event.currentTarget.value as SourceStatus)
          }
        >
          <For each={SOURCE_STATUSES}>
            {(status) => <option value={status}>{status}</option>}
          </For>
        </UISelect>

        <div class={actionsRowClass}>
          <UIButton type="submit" variant="outline" aria-busy={isApplying()}>
            Apply Status
          </UIButton>
        </div>
      </UICard>
    </section>
  );
}

/** Provisional vocabulary terms as badges; "None" once loaded and empty. */
function ProvisionalTerms(props: { terms?: string[] }) {
  return (
    <Show
      when={(props.terms?.length ?? 0) > 0}
      fallback={<span class={helperClass}>{props.terms ? "None" : "—"}</span>}
    >
      <For each={props.terms ?? []}>
        {(item) => <UIBadge tone="cream">{item}</UIBadge>}
      </For>
    </Show>
  );
}
