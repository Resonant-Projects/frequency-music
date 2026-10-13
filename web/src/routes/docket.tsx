import { useNavigate } from "@tanstack/solid-router";
import type { FunctionReturnType } from "convex/server";
import { createSignal, For, onMount, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { css, cx } from "../../styled-system/css";
import { newRequestId } from "../components/audio-feedback";
import {
  DateTime,
  helperClass,
  inlineActionLink,
  Markdown,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIList,
  UINotice,
} from "../components/ui";
import { createKeyedRows } from "../lib/keyed-rows";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
  describeLoad,
} from "../integrations/convex";

type Card = FunctionReturnType<typeof api.docket.listWeb>[number];
const KIND_LABELS: Record<Card["kind"], string> = {
  pendingDraft: "Draft to review",
  recipeNoComposition: "Recipe without a composition",
  compositionNoListening: "Composition to listen to",
  unratedAudio: "Audio to rate",
  feedProposal: "Proposed feed",
};
const OPEN_LABELS: Record<Card["kind"], string> = {
  pendingDraft: "Review draft",
  recipeNoComposition: "Open recipe",
  compositionNoListening: "Open composition",
  unratedAudio: "Rate on Listen",
  feedProposal: "Open admin",
};

const listClass = css({ display: "grid", gap: "4" });
const metaClass = css({
  alignItems: "center",
  color: "zodiac.cream/66",
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
});
const openLinkClass = cx(
  inlineActionLink,
  css({ minH: "9", _coarsePointer: { minH: "11" } }),
);
const actionsClass = css({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "3",
  marginBlockStart: "3",
});

export function DocketPage() {
  onMount(() => {
    document.title = "Docket — Frequency Music";
  });
  const cards = createQueryWithStatus(api.docket.listWeb, () => ({}));
  const rows = createKeyedRows(
    () => cards.data(),
    // A content change remounts the card, so a deferral signs what was shown.
    (row) => `${row.targetId}:${row.contentHash}`,
  );
  const load = describeLoad(cards, "the docket", () => true);
  const [done, setDone] = createSignal<string | null>(null);
  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Docket</h1>
        <p class={helperClass}>
          What is waiting on you, drafts first and then the oldest debt.
          Deferring hides a card for two weeks and is recorded as your decision.
        </p>
        <UINotice
          status={
            load.status() ??
            done() ??
            (cards.data()?.length === 0 ? "Nothing is waiting on you." : null)
          }
          error={load.error()}
        />
      </UICard>
      <Show when={!cards.isError() && (cards.data()?.length ?? 0) > 0}>
        <UIList class={listClass}>
          <For each={rows.ids()}>
            {(id) => (
              <Show when={rows.byId().get(id)}>
                {(card) => <DocketCard card={card()} onDone={setDone} />}
              </Show>
            )}
          </For>
        </UIList>
      </Show>
    </section>
  );
}

function DocketCard(props: { card: Card; onDone: (text: string) => void }) {
  const navigate = useNavigate();
  const defer = createMutation(api.decisionIntents.deferWeb);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let eventId = newRequestId();
  const headingId = () => `docket-${props.card.targetId}`;

  async function deferCard() {
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await defer({
        targetId: props.card.targetId,
        contentHash: props.card.contentHash,
        eventId,
      });
      eventId = newRequestId();
      if (result.status === "applied")
        props.onDone(`Deferred “${props.card.title}” for two weeks.`);
      else setError(result.error ?? `Deferral ${result.status}.`);
    } catch (failure) {
      // Only a transport failure keeps the ID, so its retry is deduped.
      if (typeof failure === "object" && failure !== null && "data" in failure)
        eventId = newRequestId();
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <UICard>
        <article aria-labelledby={headingId()}>
          <p class={metaClass}>
            <UIBadge tone="cream">{KIND_LABELS[props.card.kind]}</UIBadge>
            <span>
              Waiting since <DateTime value={props.card.debtSince} />
            </span>
          </p>
          <h2 id={headingId()} class={sectionTitleClass}>
            {props.card.title}
          </h2>
          <Markdown content={props.card.blurbMd} />
          <UINotice error={error()} />
          <div class={actionsClass}>
            <a
              class={openLinkClass}
              href={props.card.pageUrl}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                void navigate({ href: props.card.pageUrl });
              }}
            >
              {OPEN_LABELS[props.card.kind]}
            </a>
            <Show when={props.card.decisions.includes("defer")}>
              <UIButton
                type="button"
                variant="outline"
                aria-busy={busy()}
                onClick={() => void deferCard()}
              >
                Defer two weeks
              </UIButton>
            </Show>
          </div>
        </article>
      </UICard>
    </li>
  );
}
