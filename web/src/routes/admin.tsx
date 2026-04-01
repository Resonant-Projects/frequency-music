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
import { createMutation, createQuery } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

const helperClass = css({
  color: "rgba(245, 240, 232, 0.58)",
  fontSize: "sm",
  lineHeight: "1.6",
});

export function AdminPage() {
  onMount(() => {
    document.title = "Admin — Frequency Music";
  });

  const snapshot = createQuery(convexApi.admin.workspaceSnapshot);
  const setSourceStatus = createMutation(convexApi.admin.setSourceStatus);
  const startBatchExtraction = createMutation(
    convexApi.workflows.startBatchExtraction,
  );
  const reviewSummary = createQuery(convexApi.vocabulary.reviewSummary);

  const [sourceId, setSourceId] = createSignal("");
  const [sourceStatus, setSourceStatusValue] = createSignal("review_needed");
  const [batchLimit, setBatchLimit] = createSignal("25");
  const [notice, setNotice] = createSignal<string | null>(null);

  async function submitSourceStatus(event: SubmitEvent) {
    event.preventDefault();

    if (!sourceId().trim()) {
      setNotice("Source ID is required.");
      return;
    }

    try {
      await setSourceStatus({
        id: sourceId().trim() as Id<"sources">,
        status: sourceStatus(),
      });
      setNotice("Source status updated.");
    } catch (error) {
      setNotice(`Source status update failed: ${String(error)}`);
    }
  }

  async function queueBatchExtraction(event: SubmitEvent) {
    event.preventDefault();

    try {
      const result = await startBatchExtraction({
        limit: Number(batchLimit()) || 25,
      });
      setNotice(`Batch extraction queued: ${result.workflowId}`);
    } catch (error) {
      setNotice(`Batch extraction failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard>
        <div
          class={css({
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            gap: "3",
          })}
        >
          <div>
            <h1 class={pageTitleClass}>Admin</h1>
            <p
              class={css({
                color: "rgba(245, 240, 232, 0.62)",
                lineHeight: "1.6",
              })}
            >
              Workspace metrics and emergency operational overrides.
            </p>
          </div>
        </div>

        <div aria-live="polite">
          <Show when={notice()}>
            {(message) => (
              <p class={css({ color: "zodiac.cream", marginTop: "3" })}>
                {message()}
              </p>
            )}
          </Show>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Workspace Snapshot</h2>
        <div
          class={css({
            display: "grid",
            gap: "3",
            gridTemplateColumns: {
              base: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
            },
          })}
        >
          <div>
            <UIBadge tone="gold">Sources</UIBadge>
            <p>{snapshot()?.sources ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="violet">Hypotheses</UIBadge>
            <p>{snapshot()?.hypotheses ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="cream">Recipes</UIBadge>
            <p>{snapshot()?.recipes ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="gold">Compositions</UIBadge>
            <p>{snapshot()?.compositions ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="violet">Weekly Briefs</UIBadge>
            <p>{snapshot()?.weeklyBriefs ?? 0}</p>
          </div>
          <div>
            <UIBadge tone="cream">Feeds</UIBadge>
            <p>{snapshot()?.feeds ?? 0}</p>
          </div>
        </div>
      </UICard>

      <UICard as="form" onSubmit={queueBatchExtraction}>
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
          value={batchLimit()}
          onInput={(event) => setBatchLimit(event.currentTarget.value)}
          placeholder="25"
        />
        <div
          class={css({
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "3",
          })}
        >
          <UIButton type="submit" variant="solid">
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
        <div class={css({ display: "grid", gap: "4", marginTop: "3" })}>
          <div>
            <UIBadge tone="gold">Parameter Kinds</UIBadge>
            <div
              class={css({
                display: "flex",
                flexWrap: "wrap",
                gap: "2",
                marginTop: "2",
              })}
            >
              <Show
                when={
                  (reviewSummary()?.provisionalParameterKinds.length ?? 0) > 0
                }
                fallback={<span class={helperClass}>None</span>}
              >
                <For each={reviewSummary()?.provisionalParameterKinds ?? []}>
                  {(item) => <UIBadge tone="cream">{item}</UIBadge>}
                </For>
              </Show>
            </div>
          </div>
          <div>
            <UIBadge tone="violet">Concept Domains</UIBadge>
            <div
              class={css({
                display: "flex",
                flexWrap: "wrap",
                gap: "2",
                marginTop: "2",
              })}
            >
              <Show
                when={
                  (reviewSummary()?.provisionalConceptDomains.length ?? 0) > 0
                }
                fallback={<span class={helperClass}>None</span>}
              >
                <For each={reviewSummary()?.provisionalConceptDomains ?? []}>
                  {(item) => <UIBadge tone="cream">{item}</UIBadge>}
                </For>
              </Show>
            </div>
          </div>
          <div>
            <UIBadge tone="cream">Relationship Kinds</UIBadge>
            <div
              class={css({
                display: "flex",
                flexWrap: "wrap",
                gap: "2",
                marginTop: "2",
              })}
            >
              <Show
                when={
                  (reviewSummary()?.provisionalRelationshipKinds.length ?? 0) >
                  0
                }
                fallback={<span class={helperClass}>None</span>}
              >
                <For each={reviewSummary()?.provisionalRelationshipKinds ?? []}>
                  {(item) => <UIBadge tone="cream">{item}</UIBadge>}
                </For>
              </Show>
            </div>
          </div>
        </div>
      </UICard>

      <UICard as="form" onSubmit={submitSourceStatus}>
        <h2 class={sectionTitleClass}>Source Override</h2>
        <p
          class={css({ color: "rgba(245, 240, 232, 0.62)", marginBottom: "3" })}
        >
          Emergency/manual override. For normal source workflow, use the Display
          queue.
        </p>
        <p class={css({ marginBottom: "3" })}>
          <a
            href="/display"
            class={css({
              color: "zodiac.gold",
              fontFamily: "mono",
              fontSize: "xs",
              letterSpacing: "0.12em",
              textDecoration: "none",
              textTransform: "uppercase",
            })}
          >
            Open Display Queue →
          </a>
        </p>
        <label class={fieldLabelClass} for="admin-source-id">
          Source ID
        </label>
        <UIInput
          id="admin-source-id"
          value={sourceId()}
          onInput={(event) => setSourceId(event.currentTarget.value)}
          placeholder="k57..."
        />

        <label class={fieldLabelClass} for="admin-source-status">
          Status
        </label>
        <UISelect
          id="admin-source-status"
          value={sourceStatus()}
          onChange={(event) => setSourceStatusValue(event.currentTarget.value)}
        >
          <option value="ingested">ingested</option>
          <option value="text_ready">text_ready</option>
          <option value="extracting">extracting</option>
          <option value="review_needed">review_needed</option>
          <option value="triaged">triaged</option>
          <option value="archived">archived</option>
        </UISelect>

        <div
          class={css({
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "3",
          })}
        >
          <UIButton type="submit" variant="solid">
            Apply Status
          </UIButton>
        </div>
      </UICard>
    </section>
  );
}
