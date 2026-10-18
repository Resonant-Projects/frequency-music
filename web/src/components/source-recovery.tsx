import { createSignal, Show } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import {
  publicSourceUrl,
  RECOVERY_NOTE_MAX_CHARS,
  RECOVERY_TEXT_MAX_CHARS,
  type RecoveryKind,
} from "../../../convex/shared/sourceRecovery";
import { pdfRecoveryReason } from "../../../convex/shared/pdfCapture";
import { unextractableTextReason } from "../../../convex/shared/sourceText";
import { isMissingTextBlock } from "../../../convex/shared/statuses";
import { css } from "../../styled-system/css";
import { createMutation, describeError } from "../integrations/convex";
import {
  badgeRowClass,
  DateTime,
  fieldLabelClass,
  focusRingStyle,
  helperClass,
  UIButton,
  UIInput,
  UINotice,
  UISelect,
  UITextarea,
} from "./ui";

export type RecoverySource = {
  _id: Id<"sources">;
  title?: string;
  type: string;
  status: string;
  updatedAt: number;
  canonicalUrl?: string;
  blockedReason?: string;
  blockedDetails?: string;
  metadata?: {
    transcriptCapture?: {
      lastAttemptAt?: number;
      lastAttemptDetail?: string;
      attempts?: number;
    };
    pdfCapture?: {
      state?: string;
      code?: string;
      detail?: string;
      lastAttemptAt?: number;
    };
    sourceRecovery?: {
      accessChangedAt?: number;
      accessNote?: string;
      provenanceUrl?: string;
    };
  };
};

export function needsSourceText(source: RecoverySource) {
  return (
    source.status === "ingested" ||
    (["review_needed", "extracted"].includes(source.status) &&
      isMissingTextBlock(source.blockedReason))
  );
}

function recoveryReason(source: RecoverySource) {
  if (source.type === "pdf")
    return pdfRecoveryReason(source.metadata?.pdfCapture);
  const detail =
    source.blockedDetails ??
    source.metadata?.transcriptCapture?.lastAttemptDetail ??
    "";
  if (/access updated/i.test(detail))
    return "Access has changed. The source still needs text recovery.";
  if (/no speech|silent|lyrics|lyric fragments|no substantive/i.test(detail))
    return "No usable spoken explanation was recovered. Music or visual content needs a substantive written explanation.";
  if (/404|unavailable|private|members.only|removed/i.test(detail))
    return "The capture service could not access this source. That does not establish whether it was removed, made private, or restricted.";
  if (
    /captcha|security verification|cloudflare|log.?in|sign.?in|access restricted/i.test(
      detail,
    )
  )
    return "The source requires an access check or sign-in before its text can be recovered.";
  if (/403|429|rate.limit|failed.*times|download/i.test(detail))
    return "Automatic capture failed. Check whether the source opens for you, then provide its text or request another attempt.";
  return source.type === "youtube"
    ? "This video has no usable transcript yet. Open it to check access or copy its transcript."
    : "The source body is missing. Provide its text or describe what access has changed.";
}

const stack = css({ display: "grid", gap: "3", marginBlock: "3" });
const formClass = css({
  display: "grid",
  gap: "3",
  borderBlockStart: "hairline",
  borderColor: "zodiac.gold/24",
  paddingBlockStart: "4",
  marginBlockStart: "3",
});
const reasonClass = css({
  color: "zodiac.cream/84",
  maxInlineSize: "measure",
  lineHeight: "prose",
});
const linkClass = css({
  color: "zodiac.gold",
  overflowWrap: "anywhere",
  textDecoration: "underline",
  textUnderlineOffset: "0.2em",
  display: "inline-flex",
  alignItems: "center",
  minBlockSize: "11",
  ...focusRingStyle,
  _active: { color: "zodiac.cream" },
  "@media (hover: hover) and (pointer: fine)": {
    _hover: { color: "zodiac.goldBright" },
  },
});
const summaryClass = css({
  cursor: "pointer",
  color: "zodiac.cream/78",
  minBlockSize: "11",
  paddingBlock: "2",
  ...focusRingStyle,
  _active: { color: "zodiac.gold" },
});
const detailClass = css({
  color: "zodiac.cream/72",
  maxInlineSize: "measure",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  marginBlockEnd: "3",
});
const recoveryButtonClass = css({ minBlockSize: "11" });

export function SourceRecovery(props: {
  source: RecoverySource;
  pending: boolean;
  onNotice: (message: string) => void;
  onPending: (pending: boolean) => void;
}) {
  const saveCapture = createMutation(api.sources.provideRecoveryText);
  const requestRecovery = createMutation(api.sources.requestSourceRecovery);
  const [mode, setMode] = createSignal<"text" | "access" | null>(null);
  const [kind, setKind] = createSignal<RecoveryKind>(
    props.source.type === "youtube" ? "transcript" : "article",
  );
  const [text, setText] = createSignal("");
  const [note, setNote] = createSignal("");
  const [url, setUrl] = createSignal(props.source.canonicalUrl ?? "");
  const [expectedUpdatedAt, setExpectedUpdatedAt] = createSignal(
    props.source.updatedAt,
  );
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const busy = () => saving() || props.pending;
  const fieldId = (suffix: string) => `recovery-${props.source._id}-${suffix}`;
  const sourceUrl = () => publicSourceUrl(props.source.canonicalUrl);
  const evidenceUrl = () => {
    const evidence = publicSourceUrl(
      props.source.metadata?.sourceRecovery?.provenanceUrl,
    );
    return evidence !== sourceUrl() ? evidence : undefined;
  };
  const retryAt = () => {
    // The operator queue-clearing workflow appends "Retry <UTC ISO date>"
    // to blockedDetails when scheduling weekly access-blocker retries.
    const match = props.source.blockedDetails?.match(
      /Retry\s+(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/i,
    );
    const value = match ? Date.parse(match[1]!) : NaN;
    return Number.isFinite(value) ? value : undefined;
  };
  function open(next: "text" | "access") {
    setExpectedUpdatedAt(props.source.updatedAt);
    setError(null);
    setMode(next);
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy()) return;
    setError(null);
    if (mode() === "text") {
      const reason = unextractableTextReason(text(), {
        allowExcerpt: kind() === "excerpt",
      });
      if (reason) {
        setError(
          `${reason} Paste substantive source text, not a title, teaser or access check.`,
        );
        return;
      }
      if (url().trim() && !publicSourceUrl(url().trim())) {
        setError("Enter an http or https evidence URL without credentials.");
        return;
      }
    } else if (!note().trim()) {
      setError(
        "Describe what changed, such as completing a sign-in or the video becoming publicly available.",
      );
      return;
    }
    const trigger = event.submitter as HTMLButtonElement | null;
    const stableTarget =
      document.getElementById(fieldId("source")) ??
      document.getElementById(`source-title-${props.source._id}`);
    const row = stableTarget?.closest("[data-testid='display-row']");
    const neighbourTarget =
      row?.nextElementSibling?.querySelector<HTMLElement>(
        'a[href], button:not(:disabled):not([aria-busy="true"])',
      ) ??
      row?.previousElementSibling?.querySelector<HTMLElement>(
        'a[href], button:not(:disabled):not([aria-busy="true"])',
      );
    stableTarget?.focus();
    setSaving(true);
    props.onPending(true);
    let failed = false;
    try {
      if (mode() === "text") {
        await saveCapture({
          id: props.source._id,
          expectedUpdatedAt: expectedUpdatedAt(),
          text: text(),
          kind: kind(),
          provenanceUrl: url().trim() || undefined,
          note: note().trim() || undefined,
        });
        props.onNotice(
          "Source text saved privately. It is ready for extraction and review.",
        );
        setText("");
      } else {
        const result = await requestRecovery({
          id: props.source._id,
          expectedUpdatedAt: expectedUpdatedAt(),
          note: note().trim(),
        });
        props.onNotice(
          result.transcriptQueued
            ? "Transcript recovery requested. The capture worker will try again; browser sign-in is not shared with that worker."
            : result.pdfQueued
              ? "PDF capture requested. Lab Firecrawl will read the PDF again; browser sign-in is not shared with it."
              : "Access update saved. The source still needs text recovery in the signed-in browser.",
        );
      }
      setMode(null);
      setNote("");
    } catch (failure) {
      failed = true;
      setError(
        `Unable to save recovery information: ${describeError(failure)} Your input has been kept.`,
      );
    } finally {
      setSaving(false);
      props.onPending(false);
      if (failed && trigger?.isConnected) trigger.focus();
      else if (document.activeElement === document.body) {
        // Saving can move this source outside the 24-row live window.
        const fallback = neighbourTarget?.isConnected
          ? neighbourTarget
          : document.getElementById("display-action-queue-heading");
        fallback?.focus();
      }
    }
  }

  return (
    <div class={stack}>
      <Show when={sourceUrl()}>
        {(href) => (
          <a
            id={fieldId("source")}
            class={linkClass}
            href={href()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open original source for ${props.source.title ?? "Untitled source"}`}
          >
            Open original source
          </a>
        )}
      </Show>
      <Show when={evidenceUrl()}>
        {(href) => (
          <a
            class={linkClass}
            href={href()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open supplied evidence for ${props.source.title ?? "Untitled source"}`}
          >
            Open supplied evidence
          </a>
        )}
      </Show>
      <Show
        when={!needsSourceText(props.source) && props.source.blockedDetails}
      >
        <details>
          <summary class={summaryClass}>Failure details</summary>
          <p class={detailClass}>{props.source.blockedDetails}</p>
        </details>
      </Show>
      <Show when={needsSourceText(props.source)}>
        <p class={reasonClass}>{recoveryReason(props.source)}</p>
        <Show
          when={
            props.source.metadata?.transcriptCapture?.lastAttemptAt ??
            props.source.metadata?.pdfCapture?.lastAttemptAt
          }
        >
          {(date) => (
            <p class={helperClass}>
              Last automatic attempt{" "}
              <DateTime value={date()} format="datetime" />.
            </p>
          )}
        </Show>
        <Show when={retryAt()}>
          {(date) => (
            <p class={helperClass}>
              Next workflow retry <DateTime value={date()} format="datetime" />,
              or sooner when access or source text changes.
            </p>
          )}
        </Show>
        <Show when={props.source.metadata?.sourceRecovery?.accessNote}>
          {(accessNote) => (
            <p class={reasonClass}>Access update: {accessNote()}</p>
          )}
        </Show>
        <Show when={props.source.blockedDetails}>
          <details>
            <summary class={summaryClass}>Capture details</summary>
            <p class={detailClass}>{props.source.blockedDetails}</p>
          </details>
        </Show>
        <div class={badgeRowClass}>
          <UIButton
            class={recoveryButtonClass}
            aria-label={`Provide text for ${props.source.title ?? "Untitled source"}`}
            aria-expanded={mode() === "text"}
            aria-controls={fieldId("form")}
            disabled={busy()}
            onClick={() => open("text")}
          >
            Provide text
          </UIButton>
          <UIButton
            class={recoveryButtonClass}
            aria-label={`Report changed access for ${props.source.title ?? "Untitled source"}`}
            aria-expanded={mode() === "access"}
            aria-controls={fieldId("form")}
            disabled={busy()}
            onClick={() => open("access")}
          >
            Access changed
          </UIButton>
        </div>
        <Show when={mode()}>
          <form
            id={fieldId("form")}
            class={formClass}
            onSubmit={submit}
            aria-busy={saving()}
          >
            <Show when={mode() === "text"}>
              <div>
                <label class={fieldLabelClass} for={fieldId("kind")}>
                  What are you providing?
                </label>
                <UISelect
                  id={fieldId("kind")}
                  value={kind()}
                  disabled={saving()}
                  onChange={(event) =>
                    setKind(event.currentTarget.value as RecoveryKind)
                  }
                >
                  <option value="transcript">Transcript</option>
                  <option value="article">Article text</option>
                  <option value="excerpt">Excerpt only</option>
                  <option value="abstract">Scholarly abstract only</option>
                </UISelect>
              </div>
              <div>
                <label class={fieldLabelClass} for={fieldId("text")}>
                  Source text
                </label>
                <p id={fieldId("help")} class={helperClass}>
                  Paste at least 25 words of substantive text. Abstracts and
                  excerpts are saved with their coverage clearly labelled.
                  Saving prepares extraction; it does not complete triage.
                </p>
                <UITextarea
                  id={fieldId("text")}
                  aria-describedby={fieldId("help")}
                  rows={8}
                  required
                  maxLength={RECOVERY_TEXT_MAX_CHARS}
                  value={text()}
                  readOnly={saving()}
                  onInput={(event) => setText(event.currentTarget.value)}
                />
              </div>
              <div>
                <label class={fieldLabelClass} for={fieldId("url")}>
                  Evidence URL, optional
                </label>
                <UIInput
                  id={fieldId("url")}
                  type="url"
                  value={url()}
                  readOnly={saving()}
                  onInput={(event) => setUrl(event.currentTarget.value)}
                />
              </div>
            </Show>
            <div>
              <label class={fieldLabelClass} for={fieldId("note")}>
                {mode() === "access"
                  ? "What access changed?"
                  : "Coverage or access note, optional"}
              </label>
              <Show when={mode() === "access"}>
                <p class={helperClass}>
                  Open the original source and complete its sign-in or access
                  check first. Describe where access now works. Browser logins
                  are separate from automatic capture. Paste source text if the
                  worker still cannot access it. Keep passwords and tokens out
                  of this note.
                </p>
              </Show>
              <UITextarea
                id={fieldId("note")}
                rows={3}
                required={mode() === "access"}
                maxLength={RECOVERY_NOTE_MAX_CHARS}
                value={note()}
                readOnly={saving()}
                onInput={(event) => setNote(event.currentTarget.value)}
              />
            </div>
            <UINotice
              error={error()}
              status={saving() ? "Saving recovery information…" : null}
            />
            <Show
              when={error() && props.source.updatedAt !== expectedUpdatedAt()}
            >
              <p class={helperClass}>
                The source changed while this form was open. Review the current
                source details above before retrying with your retained input.
              </p>
              <UIButton
                class={recoveryButtonClass}
                type="button"
                disabled={busy()}
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  setExpectedUpdatedAt(props.source.updatedAt);
                  form?.requestSubmit();
                }}
              >
                Review current version and retry
              </UIButton>
            </Show>
            <div class={badgeRowClass}>
              <UIButton
                class={recoveryButtonClass}
                type="submit"
                variant="solid"
                disabled={saving()}
              >
                {saving()
                  ? "Saving…"
                  : mode() === "text"
                    ? "Save source text"
                    : "Request recovery"}
              </UIButton>
              <UIButton
                class={recoveryButtonClass}
                type="button"
                disabled={saving()}
                onClick={() => {
                  const stableTarget =
                    document.getElementById(fieldId("source")) ??
                    document.getElementById(`source-title-${props.source._id}`);
                  stableTarget?.focus();
                  setMode(null);
                  setError(null);
                }}
              >
                Cancel
              </UIButton>
            </div>
          </form>
        </Show>
      </Show>
    </div>
  );
}
