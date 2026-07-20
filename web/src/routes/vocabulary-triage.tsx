import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { css } from "../../styled-system/css";
import {
  fieldLabelClass,
  pageClass,
  pageTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UISelect,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";

type TriageBoard = FunctionReturnType<typeof api.vocabulary.triageBoard>;
type TriageList = TriageBoard[keyof TriageBoard];
type TriageEntry = TriageList["provisional"][number];
type KnownTarget = TriageList["knownTargets"][number];
type VocabularyList = FunctionArgs<typeof api.vocabulary.promoteEntry>["list"];
type Decision = "promote" | "merge" | "reject";

const helperClass = css({
  color: "rgba(245, 240, 232, 0.62)",
  lineHeight: "1.6",
});

const eyebrowClass = css({
  color: "rgba(245, 240, 232, 0.58)",
  fontFamily: "mono",
  fontSize: "2xs",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
});

const triageRowClass = css({
  borderColor: "rgba(245, 240, 232, 0.12)",
  borderRadius: "l2",
  borderWidth: "1px",
  display: "grid",
  gap: "3",
  p: { base: "3", md: "4" },
});

function mentionLabel(entry: TriageEntry) {
  if (entry.mentionCount === null) return null;
  return `${entry.mentionCount}${entry.mentionCountCapped ? "+" : ""} mention${entry.mentionCount === 1 ? "" : "s"}`;
}

function formatCreatedAt(createdAt: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(createdAt),
  );
}

function TriageRow(props: {
  entry: TriageEntry;
  knownTargets: KnownTarget[];
  list: VocabularyList;
}) {
  const promote = createMutation(api.vocabulary.promoteEntry);
  const reject = createMutation(api.vocabulary.rejectEntry);
  const merge = createMutation(api.vocabulary.mergeEntry);
  const [decision, setDecision] = createSignal<Decision | null>(null);
  const [targetEntryId, setTargetEntryId] = createSignal("");
  const [note, setNote] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const canConfirm = createMemo(
    () => decision() !== "merge" || targetEntryId().length > 0,
  );

  function chooseDecision(next: Decision) {
    setError(null);
    setDecision(next);
  }

  async function confirmDecision() {
    const selected = decision();
    if (!selected || !canConfirm()) return;
    setBusy(true);
    setError(null);
    const optionalNote = note().trim() ? { note: note().trim() } : {};
    try {
      if (selected === "promote") {
        await promote({
          list: props.list,
          entryId: props.entry._id,
          ...optionalNote,
        });
      } else if (selected === "reject") {
        await reject({
          list: props.list,
          entryId: props.entry._id,
          ...optionalNote,
        });
      } else {
        await merge({
          list: props.list,
          sourceEntryId: props.entry._id,
          targetEntryId: targetEntryId(),
          ...optionalNote,
        });
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Vocabulary decision failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article class={triageRowClass}>
      <div
        class={css({
          alignItems: "flex-start",
          display: "flex",
          flexWrap: "wrap",
          gap: "3",
          justifyContent: "space-between",
        })}
      >
        <div class={css({ display: "grid", gap: "2" })}>
          <div class={css({ alignItems: "center", display: "flex", gap: "2" })}>
            <Show
              when={props.list === "conceptDomain"}
              fallback={
                <h3
                  class={css({
                    color: "zodiac.cream",
                    fontFamily: "display",
                    fontSize: "xl",
                    fontWeight: "normal",
                  })}
                >
                  {props.entry.displayLabel ?? props.entry.name}
                </h3>
              }
            >
              <UIBadge tone="violet">
                {props.entry.displayLabel ?? props.entry.name}
              </UIBadge>
            </Show>
          </div>
          <p class={eyebrowClass}>
            Added {formatCreatedAt(props.entry.createdAt)}
            <Show when={mentionLabel(props.entry)}>
              {(label) => ` · ${label()}`}
            </Show>
          </p>
        </div>
        <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
          <UIButton
            variant="outline"
            aria-pressed={decision() === "promote"}
            disabled={busy()}
            onClick={() => chooseDecision("promote")}
          >
            Promote
          </UIButton>
          <UIButton
            variant="outline"
            aria-pressed={decision() === "merge"}
            disabled={busy() || props.knownTargets.length === 0}
            onClick={() => chooseDecision("merge")}
          >
            Merge →
          </UIButton>
          <UIButton
            variant="ghost"
            aria-pressed={decision() === "reject"}
            disabled={busy()}
            onClick={() => chooseDecision("reject")}
          >
            Reject
          </UIButton>
        </div>
      </div>

      <Show when={props.entry.description || props.entry.notes}>
        <div class={css({ display: "grid", gap: "1" })}>
          <Show when={props.entry.description}>
            {(description) => <p class={helperClass}>{description()}</p>}
          </Show>
          <Show when={props.entry.notes}>
            {(notes) => <p class={helperClass}>{notes()}</p>}
          </Show>
        </div>
      </Show>

      <Show when={decision()}>
        {(selectedDecision) => (
          <div
            class={css({
              bg: "rgba(26, 15, 53, 0.32)",
              borderRadius: "l2",
              display: "grid",
              gap: "3",
              p: "3",
            })}
          >
            <Show when={selectedDecision() === "merge"}>
              <div class={css({ display: "grid", gap: "2" })}>
                <label
                  class={fieldLabelClass}
                  for={`merge-target-${props.entry._id}`}
                >
                  Known target in this list
                </label>
                <UISelect
                  id={`merge-target-${props.entry._id}`}
                  value={targetEntryId()}
                  onChange={(event) =>
                    setTargetEntryId(event.currentTarget.value)
                  }
                >
                  <option value="">Choose a target…</option>
                  <For each={props.knownTargets}>
                    {(target) => (
                      <option value={target._id}>{target.name}</option>
                    )}
                  </For>
                </UISelect>
              </div>
            </Show>
            <div class={css({ display: "grid", gap: "2" })}>
              <label
                class={fieldLabelClass}
                for={`decision-note-${props.entry._id}`}
              >
                Decision note (optional)
              </label>
              <UIInput
                id={`decision-note-${props.entry._id}`}
                value={note()}
                maxLength={500}
                onInput={(event) => setNote(event.currentTarget.value)}
                placeholder="Record the reasoning for this decision."
              />
            </div>
            <div aria-live="polite">
              <Show when={error()}>
                {(message) => (
                  <p class={css({ color: "zodiac.violet", lineHeight: "1.5" })}>
                    {message()}
                  </p>
                )}
              </Show>
            </div>
            <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
              <UIButton
                variant="solid"
                disabled={busy() || !canConfirm()}
                onClick={confirmDecision}
              >
                {busy()
                  ? "Deciding…"
                  : `Confirm ${selectedDecision() === "merge" ? "merge" : selectedDecision()}`}
              </UIButton>
              <UIButton
                variant="ghost"
                disabled={busy()}
                onClick={() => setDecision(null)}
              >
                Cancel
              </UIButton>
            </div>
          </div>
        )}
      </Show>
    </article>
  );
}

function TriageSection(props: {
  title: string;
  list: VocabularyList;
  data: TriageList | undefined;
}) {
  return (
    <UICard
      class={css({
        borderColor: "rgba(139, 92, 246, 0.22)",
      })}
    >
      <h2
        class={css({
          color: "zodiac.cream",
          fontFamily: "display",
          fontSize: "2xl",
          fontWeight: "normal",
          lineHeight: "1.2",
          textWrap: "balance",
        })}
      >
        {props.title}
      </h2>
      <div class={css({ display: "grid", gap: "3", mt: "4" })}>
        <Show
          when={(props.data?.provisional.length ?? 0) > 0}
          fallback={<p class={helperClass}>No provisional entries remain.</p>}
        >
          <For each={props.data?.provisional ?? []}>
            {(entry) => (
              <TriageRow
                entry={entry}
                knownTargets={props.data?.knownTargets ?? []}
                list={props.list}
              />
            )}
          </For>
        </Show>
      </div>
    </UICard>
  );
}

export function VocabularyTriagePage() {
  onMount(() => {
    document.title = "Vocabulary Triage — Frequency Music";
  });

  const board = createQueryWithStatus(api.vocabulary.triageBoard);

  return (
    <section class={pageClass}>
      <UICard class={css({ borderColor: "rgba(139, 92, 246, 0.22)" })}>
        <p class={eyebrowClass}>Domain Triage</p>
        <h1 class={pageTitleClass}>Curate the vocabulary registry.</h1>
        <p
          class={css({
            color: "rgba(245, 240, 232, 0.62)",
            lineHeight: "1.6",
            maxW: "70ch",
          })}
        >
          Promote durable terms, merge near-synonyms into known registry rows,
          and reject vocabulary that should not enter future mining passes.
        </p>
        <div
          class={css({
            display: "flex",
            flexWrap: "wrap",
            gap: "2",
            mt: "5",
          })}
        >
          <For
            each={[
              {
                label: "Concept Domains",
                count: board.data()?.conceptDomains.provisional.length ?? 0,
              },
              {
                label: "Parameter Kinds",
                count: board.data()?.parameterKinds.provisional.length ?? 0,
              },
              {
                label: "Relationship Kinds",
                count: board.data()?.relationshipKinds.provisional.length ?? 0,
              },
            ]}
          >
            {(summary) => (
              <UIBadge
                tone={summary.label === "Concept Domains" ? "violet" : "cream"}
              >
                {board.isLoading() ? "—" : summary.count} {summary.label}{" "}
                remaining
              </UIBadge>
            )}
          </For>
        </div>
        <Show when={board.isLoading()}>
          <p
            class={css({
              color: "rgba(245, 240, 232, 0.62)",
              lineHeight: "1.6",
              mt: "4",
            })}
          >
            Loading triage debt…
          </p>
        </Show>
        <Show when={board.error()}>
          {(error) => (
            <p
              class={css({
                color: "zodiac.violet",
                lineHeight: "1.6",
                mt: "4",
              })}
            >
              Unable to load vocabulary triage: {error().message}
            </p>
          )}
        </Show>
      </UICard>

      <TriageSection
        title="Concept Domains"
        list="conceptDomain"
        data={board.data()?.conceptDomains}
      />
      <TriageSection
        title="Parameter Kinds"
        list="parameterKind"
        data={board.data()?.parameterKinds}
      />
      <TriageSection
        title="Relationship Kinds"
        list="relationshipKind"
        data={board.data()?.relationshipKinds}
      />
    </section>
  );
}
