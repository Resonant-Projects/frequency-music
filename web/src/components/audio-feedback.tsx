import type { FunctionReturnType } from "convex/server";
import { createMemo, createSignal, For, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import {
  AUDIO_RATING_NOTES_MAX,
  SCORE_KEYS_BY_KIND,
  type AudioScoreKey,
} from "../../../convex/shared/audioFeedback";
import { css, cx } from "../../styled-system/css";
import { createKeyedRows } from "../lib/keyed-rows";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
  describeLoad,
} from "../integrations/convex";
import { AudioPlayer } from "./audio-player";
import {
  DateTime,
  fieldLabelClass,
  helperClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UIList,
  UINotice,
  UISelect,
  UITextarea,
} from "./ui";

type QueueItem = FunctionReturnType<typeof api.audioFeedback.queue>[number];
type Method = "headphones" | "monitors" | "car" | "phone speaker";

const SCORE_LABELS: Record<AudioScoreKey, string> = {
  overall: "Overall",
  clarity: "Clarity",
  naturalness: "Naturalness",
  pacing: "Pacing",
  bodilyPleasantness: "Bodily pleasantness",
  goosebumps: "Goosebumps",
  perceivedConsonance: "Perceived consonance",
  musicality: "Musicality",
  easeOfComposability: "Ease of composing with",
  expandability: "Expandability",
};
const KIND_LABELS = { episode: "Episode", litmusRender: "Litmus render" };
const METHODS: Method[] = ["headphones", "monitors", "car", "phone speaker"];

/** Stable per attempt; a transport retry reuses it so the server can dedupe. */
export function newRequestId(): string {
  return `web-${crypto.randomUUID()}`;
}
/** A ConvexError carries data: the server answered, so the request is spent. */
function serverAnswered(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    (error as { data?: unknown }).data !== undefined
  );
}
function parseScore(raw: string): number | null | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : null;
}

const listClass = css({ display: "grid", gap: "4" });
const itemClass = css({
  borderBlockEndWidth: "1px",
  borderColor: "zodiac.gold/22",
  display: "grid",
  gap: "3",
  paddingBlockEnd: "5",
  _last: { borderBlockEnd: "none", paddingBlockEnd: "0" },
});
const metaClass = css({
  alignItems: "center",
  color: "zodiac.cream/66",
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
});
// Fields wrap to the space they have, with no breakpoint ladder.
const scoreGridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 8rem), 1fr))",
});
const fieldClass = css({ display: "flex", flexDirection: "column", gap: "1" });
const fieldsetClass = css({ border: "none", margin: "0", padding: "0" });
const legendClass = cx(fieldLabelClass, css({ marginBlockEnd: "2" }));
const conditionsClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))",
});
const actionsClass = css({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "3",
});

/** Ready, blind-safe audio that still needs a human ear. `focusId` (a docket
 * link) pins one artifact first, even when it is outside the queue window. */
export function AudioFeedbackQueue(props: { focusId?: string }) {
  const queue = createQueryWithStatus(api.audioFeedback.queue, () => ({}));
  const focus = createQueryWithStatus(api.audioFeedback.item, () =>
    props.focusId ? { artifactId: props.focusId } : "skip",
  );
  // Keyed by content version: new audio under the same ID remounts the form,
  // so a draft written for the old version can never be saved against it.
  const rows = createKeyedRows(
    () =>
      queue
        .data()
        ?.filter((row) => row.artifactId !== focus.data()?.artifactId),
    (row) => `${row.artifactId}:${row.contentHash}`,
  );
  const load = describeLoad(queue, "audio to rate", () => true);
  const [done, setDone] = createSignal<string | null>(null);
  const focusKey = createMemo(() => {
    const row = focus.data();
    return row ? `${row.artifactId}:${row.contentHash}` : null;
  });
  // A saved or deferred linked item stays rateable server-side; hide it here.
  const [dismissed, setDismissed] = createSignal<string | null>(null);
  const focusError = () => {
    if (!props.focusId) return null;
    if (focus.isError())
      return `Unable to load the linked audio: ${focus.error()?.message}`;
    return !focus.isLoading() && focus.data() === null
      ? "The linked audio is not available for rating."
      : null;
  };
  return (
    <UICard>
      <h2 class={sectionTitleClass}>Rate audio</h2>
      <p class={helperClass}>
        Episodes and renders waiting for your ear. Every score is optional; a
        blank score is saved as not given, and 0 is a real score.
      </p>
      <UINotice
        status={
          load.status() ??
          done() ??
          (queue.data()?.length === 0 && !focus.data()
            ? "Nothing is waiting to be rated."
            : null)
        }
        error={load.error() ?? focusError()}
      />
      <Show when={focusKey() !== dismissed() && focusKey()} keyed>
        {(key) => (
          <Show when={focus.data()}>
            {(item) => (
              <UIList class={listClass}>
                <AudioFeedbackItem
                  item={item()}
                  onDone={(message) => {
                    setDismissed(key);
                    setDone(message);
                  }}
                />
              </UIList>
            )}
          </Show>
        )}
      </Show>
      <Show when={!queue.isError() && (rows.ids().length ?? 0) > 0}>
        <UIList class={listClass}>
          <For each={rows.ids()}>
            {(id) => (
              <Show when={rows.byId().get(id)}>
                {(item) => <AudioFeedbackItem item={item()} onDone={setDone} />}
              </Show>
            )}
          </For>
        </UIList>
      </Show>
    </UICard>
  );
}

function AudioFeedbackItem(props: {
  item: QueueItem;
  onDone: (message: string) => void;
}) {
  const playback = createQueryWithStatus(api.audioArtifacts.playback, () => ({
    artifactId: props.item.artifactId,
  }));
  const submit = createMutation(api.audioFeedback.submit);
  const defer = createMutation(api.decisionIntents.deferWeb);
  const keys = () => SCORE_KEYS_BY_KIND[props.item.kind];
  const [scores, setScores] = createSignal<
    Partial<Record<AudioScoreKey, string>>
  >({});
  const [method, setMethod] = createSignal<Method | "">("");
  const [timeOfDay, setTimeOfDay] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [invalid, setInvalid] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal<"rate" | "defer" | null>(null);
  let rateRequest = newRequestId();
  let deferRequest = newRequestId();
  const base = () => `audio-${props.item.artifactId}`;

  async function rate() {
    if (busy()) return;
    const parsed: Partial<Record<AudioScoreKey, number>> = {};
    for (const key of keys()) {
      const value = parseScore(scores()[key] ?? "");
      if (value === null) {
        setInvalid(key);
        setError(`${SCORE_LABELS[key]} needs a whole number from 0 to 5.`);
        document.getElementById(`${base()}-${key}`)?.focus();
        return;
      }
      if (value !== undefined) parsed[key] = value;
    }
    const time = timeOfDay().trim();
    if (Boolean(method()) !== Boolean(time)) {
      setInvalid(method() ? "time" : "method");
      setError("Record both how and when you listened, or neither.");
      return;
    }
    const note = notes().trim();
    if (!Object.keys(parsed).length && !note) {
      setInvalid(null);
      setError("Give at least one score or a note.");
      return;
    }
    setInvalid(null);
    setError(null);
    setBusy("rate");
    try {
      const result = await submit({
        artifactId: props.item.artifactId,
        contentHash: props.item.contentHash,
        clientRequestId: rateRequest,
        payload: {
          scores: parsed,
          conditions: method()
            ? { listeningMethod: method() as Method, timeOfDay: time }
            : undefined,
          notes: note || undefined,
        },
      });
      rateRequest = newRequestId();
      props.onDone(
        result.replayed
          ? `Your rating of “${props.item.title}” was already saved.`
          : `Saved your rating of “${props.item.title}”.`,
      );
    } catch (failure) {
      // Keep the request ID across transport failures so a retry is deduped.
      if (serverAnswered(failure)) rateRequest = newRequestId();
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  }

  async function deferItem() {
    if (busy()) return;
    setError(null);
    setBusy("defer");
    try {
      const result = await defer({
        targetId: props.item.artifactId,
        contentHash: props.item.docketContentHash,
        eventId: deferRequest,
      });
      deferRequest = newRequestId();
      if (result.status !== "applied")
        setError(result.error ?? `Deferral ${result.status}.`);
      else props.onDone(`Deferred “${props.item.title}” for two weeks.`);
    } catch (failure) {
      if (serverAnswered(failure)) deferRequest = newRequestId();
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  }

  return (
    <li class={itemClass} aria-labelledby={`${base()}-heading`}>
      <Show
        when={!playback.isError() && playback.data()}
        fallback={
          <h3 id={`${base()}-heading`} class={sectionTitleClass}>
            {props.item.title}
          </h3>
        }
      >
        {(audio) => (
          <AudioPlayer
            src={audio().url}
            label={props.item.title}
            durationSecs={audio().durationSecs ?? props.item.durationSecs}
            headingLevel={3}
            headingId={`${base()}-heading`}
            preload="none"
          />
        )}
      </Show>
      <p class={metaClass}>
        <UIBadge tone="cream">{KIND_LABELS[props.item.kind]}</UIBadge>
        <Show when={props.item.engineName}>
          {(engine) => <span>{engine()}</span>}
        </Show>
        <Show when={props.item.validation === "unvalidated"}>
          <UIBadge>unvalidated render</UIBadge>
        </Show>
        <DateTime value={props.item.createdAt} />
      </p>
      <Show when={playback.isError() || playback.data() === null}>
        <UINotice
          error={
            playback.isError()
              ? `Unable to load audio: ${playback.error()?.message}`
              : "Audio is unavailable."
          }
        />
      </Show>
      <fieldset class={fieldsetClass}>
        <legend class={legendClass}>Scores, 0 to 5 (optional)</legend>
        <div class={scoreGridClass}>
          <For each={keys()}>
            {(key) => (
              <div class={fieldClass}>
                <label class={fieldLabelClass} for={`${base()}-${key}`}>
                  {SCORE_LABELS[key]}
                </label>
                <UIInput
                  id={`${base()}-${key}`}
                  type="number"
                  min="0"
                  max="5"
                  step="1"
                  inputmode="numeric"
                  placeholder="not given"
                  aria-invalid={invalid() === key ? "true" : undefined}
                  value={scores()[key] ?? ""}
                  onInput={(event) =>
                    setScores({
                      ...scores(),
                      [key]: event.currentTarget.value,
                    })
                  }
                />
              </div>
            )}
          </For>
        </div>
      </fieldset>
      <fieldset class={fieldsetClass}>
        <legend class={legendClass}>Listening conditions (optional)</legend>
        <div class={conditionsClass}>
          <div class={fieldClass}>
            <label class={fieldLabelClass} for={`${base()}-method`}>
              Listened on
            </label>
            <UISelect
              id={`${base()}-method`}
              value={method()}
              aria-invalid={invalid() === "method" ? "true" : undefined}
              onChange={(event) =>
                setMethod(event.currentTarget.value as Method | "")
              }
            >
              <option value="">Not recorded</option>
              <For each={METHODS}>
                {(value) => <option value={value}>{value}</option>}
              </For>
            </UISelect>
          </div>
          <div class={fieldClass}>
            <label class={fieldLabelClass} for={`${base()}-time`}>
              Time of day
            </label>
            <UIInput
              id={`${base()}-time`}
              maxLength={100}
              placeholder="e.g. evening"
              aria-invalid={invalid() === "time" ? "true" : undefined}
              value={timeOfDay()}
              onInput={(event) => setTimeOfDay(event.currentTarget.value)}
            />
          </div>
        </div>
      </fieldset>
      <div class={fieldClass}>
        <label class={fieldLabelClass} for={`${base()}-notes`}>
          Notes
        </label>
        <UITextarea
          id={`${base()}-notes`}
          maxLength={AUDIO_RATING_NOTES_MAX}
          rows={3}
          value={notes()}
          onInput={(event) => setNotes(event.currentTarget.value)}
        />
      </div>
      <UINotice error={error()} />
      <div class={actionsClass}>
        <UIButton
          type="button"
          aria-busy={busy() === "rate"}
          onClick={() => void rate()}
        >
          Save rating
        </UIButton>
        <UIButton
          type="button"
          variant="outline"
          aria-busy={busy() === "defer"}
          onClick={() => void deferItem()}
        >
          Defer two weeks
        </UIButton>
      </div>
    </li>
  );
}
