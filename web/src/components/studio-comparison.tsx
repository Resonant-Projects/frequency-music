// Plan 11 step 3 on /listen: upload a studio render of one machine litmus
// baseline, then rate the pair blind. Before reveal the panel knows only
// labels and playback URLs; the mapping and provenance arrive from the
// server after the ratings are saved.
import type { FunctionReturnType } from "convex/server";
import { createEffect, createSignal, For, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  AUDIO_RATING_NOTES_MAX,
  RENDER_SCORE_KEYS,
  type AudioScoreKey,
} from "../../../convex/shared/audioRatingKeys";
import {
  STUDIO_ENCODE_COMMAND,
  STUDIO_NOTES_MAX,
  STUDIO_REQUIRED_SCORE_KEYS,
  STUDIO_TARGET_LUFS,
  STUDIO_TEXT_MAX,
  STUDIO_TUNING_METHODS,
  studioProvenanceProblems,
  type StudioProvenance,
  type StudioTuningMethod,
} from "../../../convex/shared/studioComparison";
import { MAX_UPLOAD_BYTES } from "../../../convex/shared/uploadLimits";
import { css, cx } from "../../styled-system/css";
import { createKeyedRows } from "../lib/keyed-rows";
import {
  createAction,
  createMutation,
  createQueryWithStatus,
  describeError,
  describeLoad,
} from "../integrations/convex";
import { METHODS, SCORE_LABELS, type Method } from "./audio-feedback";
import { AudioPlayer } from "./audio-player";
import {
  DateTime,
  fieldLabelClass,
  helperClass,
  jsonBlockClass,
  metaLine,
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

type Candidate = FunctionReturnType<
  typeof api.studioComparisons.machineCandidates
>[number];
type Detail = FunctionReturnType<typeof api.studioComparisons.get>;

const TUNING_LABELS: Record<StudioTuningMethod, string> = {
  scala: "Scala .scl/.kbm in the instrument",
  "mts-esp": "MTS-ESP Master",
  other: "Other (describe in notes)",
};
const REQUIRED = new Set<AudioScoreKey>(STUDIO_REQUIRED_SCORE_KEYS);
const COMPARISON_PANEL_ID = "studio-comparison-panel";

const stackClass = css({ display: "grid", gap: "4" });
const fieldClass = css({ display: "flex", flexDirection: "column", gap: "1" });
const fieldsetClass = css({ border: "none", margin: "0", padding: "0" });
const legendClass = cx(fieldLabelClass, css({ marginBlockEnd: "2" }));
// Fields wrap to the space they have, with no breakpoint ladder.
const gridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))",
});
const scoreGridClass = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 8rem), 1fr))",
});
const actionsClass = css({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "3",
});
const memberClass = css({
  borderBlockEndWidth: "1px",
  borderColor: "zodiac.gold/22",
  display: "grid",
  gap: "3",
  paddingBlockEnd: "5",
  _last: { borderBlockEnd: "none", paddingBlockEnd: "0" },
});
const rowButtonClass = css({
  alignItems: "center",
  bg: "transparent",
  borderInlineStartColor: "transparent",
  borderInlineStartWidth: "2px",
  color: "zodiac.cream/82",
  cursor: "pointer",
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
  minH: "9",
  paddingInlineStart: "2",
  py: "1",
  textAlign: "start",
  w: "full",
  _hover: { color: "zodiac.cream" },
  _coarsePointer: { minH: "11" },
  "&[aria-pressed='true']": {
    borderInlineStartColor: "zodiac.gold",
    color: "zodiac.gold",
  },
});
const definitionClass = css({
  display: "grid",
  gap: "2",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 16rem), 1fr))",
  "& dt": { color: "zodiac.cream/66", fontFamily: "mono", fontSize: "xs" },
  "& dd": { color: "zodiac.cream", margin: "0", overflowWrap: "anywhere" },
});
const slotClass = css({ display: "contents" });
const listClass = css({ display: "flex", flexDirection: "column", gap: "1" });

function parseScore(raw: string): number | null | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : null;
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

const shortDigest = (digest: string) => digest.slice(0, 12);

/** The /listen section: comparisons, the selected one, and the upload form. */
export function StudioComparisons() {
  const list = createQueryWithStatus(api.studioComparisons.list, () => ({}));
  const rows = createKeyedRows(
    () => list.data(),
    (row) => String(row.groupId),
  );
  const load = describeLoad(list, "studio comparisons", () => true);
  const [selected, setSelected] = createSignal<Id<"blindGroups"> | null>(null);
  // Latch the newest comparison once, as the shootout list does.
  createEffect(() => {
    const first = list.data()?.[0]?.groupId;
    if (selected() === null && first) setSelected(first);
  });
  return (
    <>
      <UICard>
        <h2 class={sectionTitleClass}>Studio comparisons</h2>
        <p class={helperClass}>
          Your studio render of a machine litmus render, rated blind. Rate both
          takes to reveal which is which. A rating never validates a render; the
          go or no-go decision is recorded separately.
        </p>
        <UINotice
          status={
            load.status() ??
            (list.data()?.length === 0 ? "No studio comparisons yet." : null)
          }
          error={load.error()}
        />
        <Show when={rows.ids().length > 0}>
          <UIList class={listClass}>
            <For each={rows.ids()}>
              {(id) => (
                <Show when={rows.byId().get(id)}>
                  {(row) => (
                    <li>
                      <button
                        type="button"
                        class={rowButtonClass}
                        aria-pressed={selected() === row().groupId}
                        aria-controls={COMPARISON_PANEL_ID}
                        onClick={() => setSelected(row().groupId)}
                      >
                        <span>
                          {row().recipeTitle} ·{" "}
                          <DateTime value={row().createdAt} format="datetime" />
                        </span>
                        <Show when={row().revealed}>
                          <UIBadge tone="gold">revealed</UIBadge>
                        </Show>
                      </button>
                    </li>
                  )}
                </Show>
              )}
            </For>
          </UIList>
        </Show>
      </UICard>
      {/* Always mounted so aria-controls resolves. */}
      <div id={COMPARISON_PANEL_ID} class={slotClass}>
        <Show when={selected()} keyed>
          {(groupId) => <ComparisonPanel groupId={groupId} />}
        </Show>
      </div>
      <StudioUploadForm onGrouped={setSelected} />
    </>
  );
}

type ProvenanceForm = Record<
  "daw" | "instrument" | "effects" | "tunerCheck" | "lufs" | "peak" | "notes",
  string
>;
const EMPTY_PROVENANCE: ProvenanceForm = {
  daw: "",
  instrument: "",
  effects: "",
  tunerCheck: "",
  lufs: "",
  peak: "",
  notes: "",
};

function StudioUploadForm(props: {
  onGrouped: (groupId: Id<"blindGroups">) => void;
}) {
  const candidates = createQueryWithStatus(
    api.studioComparisons.machineCandidates,
    () => ({}),
  );
  const begin = createMutation(api.studioComparisons.beginUpload);
  const finish = createAction(api.studioComparisons.finishUpload);
  const [machineId, setMachineId] = createSignal("");
  const [planFile, setPlanFile] = createSignal<File | null>(null);
  const [audioFile, setAudioFile] = createSignal<File | null>(null);
  const [tuning, setTuning] = createSignal<StudioTuningMethod>("mts-esp");
  const [form, setForm] = createSignal<ProvenanceForm>(EMPTY_PROVENANCE);
  const [status, setStatus] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const load = describeLoad(candidates, "machine renders", () => true);
  const set = (key: keyof ProvenanceForm, value: string) =>
    setForm({ ...form(), [key]: value });
  const chosen = (): Candidate | undefined =>
    candidates.data()?.find((row) => row.artifactId === machineId());

  async function submit() {
    if (busy()) return;
    setError(null);
    setStatus(null);
    const machine = chosen();
    const plan = planFile();
    const audio = audioFile();
    if (!machine) return setError("Choose the machine render you rendered.");
    if (!plan)
      return setError("Choose the render-plan.json you rendered from.");
    if (!audio) return setError("Choose the studio MP3.");
    if (audio.size > MAX_UPLOAD_BYTES)
      return setError(
        `The MP3 is larger than the ${MAX_UPLOAD_BYTES / 1e6} MB upload cap.`,
      );
    const values = form();
    const provenance: StudioProvenance = {
      daw: values.daw.trim(),
      instrument: values.instrument.trim(),
      tuningMethod: tuning(),
      effects: values.effects.trim(),
      tunerCheck: values.tunerCheck.trim(),
      integratedLufs: Number(
        values.lufs.trim() === "" ? Number.NaN : values.lufs,
      ),
      truePeakDbtp: Number(
        values.peak.trim() === "" ? Number.NaN : values.peak,
      ),
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    };
    const problems = studioProvenanceProblems(provenance);
    if (problems.length) return setError(`${problems.join("; ")}.`);
    setBusy(true);
    try {
      let renderPlan: unknown;
      try {
        renderPlan = JSON.parse(await plan.text());
      } catch {
        throw new Error("render-plan.json is not valid JSON.");
      }
      // The server checks frame structure, not the compressed audio; a file
      // the browser cannot decode would make a comparison nobody can hear.
      setStatus("Decoding the MP3...");
      try {
        await new OfflineAudioContext(2, 1, 48000).decodeAudioData(
          await audio.arrayBuffer(),
        );
      } catch {
        throw new Error(
          "This MP3 does not decode. Re-encode it with the command above.",
        );
      }
      setStatus("Checking the file...");
      const started = await begin({
        machineArtifactId: machine.artifactId,
        byteLength: audio.size,
        sha256: await sha256Hex(audio),
        renderPlan,
        provenance,
      });
      let groupId = started.groupId;
      if (started.uploadUrl) {
        setStatus("Uploading...");
        const response = await fetch(started.uploadUrl, {
          method: "POST",
          headers: { "content-type": "audio/mpeg" },
          body: audio,
          redirect: "error",
        });
        if (!response.ok)
          throw new Error(`Upload failed (${response.status}).`);
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        setStatus("Inspecting the upload...");
        groupId = (await finish({ artifactId: started.artifactId, storageId }))
          .groupId;
      }
      if (!groupId)
        throw new Error("The upload is still pending. Try again to finish it.");
      setStatus(
        "Comparison ready. The two takes are labelled at random; rate both to reveal them.",
      );
      setForm(EMPTY_PROVENANCE);
      props.onGrouped(groupId);
    } catch (failure) {
      setStatus(null);
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  const textField = (
    key: "daw" | "instrument" | "effects" | "tunerCheck",
    label: string,
    placeholder: string,
  ) => (
    <div class={fieldClass}>
      <label class={fieldLabelClass} for={`studio-${key}`}>
        {label}
      </label>
      <UIInput
        id={`studio-${key}`}
        maxLength={STUDIO_TEXT_MAX}
        placeholder={placeholder}
        value={form()[key]}
        onInput={(event) => set(key, event.currentTarget.value)}
      />
    </div>
  );

  return (
    <UICard>
      <h2 class={sectionTitleClass}>Upload a studio render</h2>
      <p class={helperClass}>
        Render the machine render's plan in the studio, following its kit card,
        then encode your 48 kHz, 24-bit WAV exactly as the machine delivery is
        encoded, so the two files differ only in sound:
      </p>
      <pre
        class={cx(jsonBlockClass, "zodiac-scroll")}
        role="group"
        tabIndex={0}
        aria-label="Encoding command"
      >
        {STUDIO_ENCODE_COMMAND}
      </pre>
      <form
        class={stackClass}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <UINotice error={load.error()} status={load.status()} />
        <div class={fieldClass}>
          <label class={fieldLabelClass} for="studio-machine">
            Machine render
          </label>
          <UISelect
            id="studio-machine"
            value={machineId()}
            onChange={(event) => setMachineId(event.currentTarget.value)}
          >
            <option value="">
              {candidates.data()?.length === 0
                ? "No machine render is waiting for comparison"
                : "Choose a machine render"}
            </option>
            <For each={candidates.data() ?? []}>
              {(row) => (
                <option value={row.artifactId}>
                  {row.recipeTitle} · {row.durationSecs} s · renderer{" "}
                  {row.rendererVersion} · plan {shortDigest(row.planDigest)}
                </option>
              )}
            </For>
          </UISelect>
          <Show when={chosen()}>
            {(row) => (
              <p class={metaLine}>
                Recipe revision saved{" "}
                <DateTime value={row().recipeUpdatedAt} format="datetime" />;
                rendered <DateTime value={row().createdAt} format="datetime" />.
              </p>
            )}
          </Show>
        </div>
        <div class={gridClass}>
          <div class={fieldClass}>
            <label class={fieldLabelClass} for="studio-plan">
              render-plan.json you rendered from
            </label>
            <UIInput
              id="studio-plan"
              type="file"
              accept="application/json,.json"
              onChange={(event) =>
                setPlanFile(event.currentTarget.files?.[0] ?? null)
              }
            />
          </div>
          <div class={fieldClass}>
            <label class={fieldLabelClass} for="studio-audio">
              Studio MP3
            </label>
            <UIInput
              id="studio-audio"
              type="file"
              accept="audio/mpeg,.mp3"
              onChange={(event) =>
                setAudioFile(event.currentTarget.files?.[0] ?? null)
              }
            />
          </div>
        </div>
        <fieldset class={fieldsetClass}>
          <legend class={legendClass}>Provenance</legend>
          <div class={gridClass}>
            {textField("daw", "Host / DAW and version", "e.g. Bitwig 5.2")}
            {textField(
              "instrument",
              "Instrument and patch",
              "e.g. Diva, init patch",
            )}
            <div class={fieldClass}>
              <label class={fieldLabelClass} for="studio-tuning">
                Tuning method
              </label>
              <UISelect
                id="studio-tuning"
                value={tuning()}
                onChange={(event) =>
                  setTuning(event.currentTarget.value as StudioTuningMethod)
                }
              >
                <For each={STUDIO_TUNING_METHODS}>
                  {(method) => (
                    <option value={method}>{TUNING_LABELS[method]}</option>
                  )}
                </For>
              </UISelect>
            </div>
            {textField("effects", "Effects", "none, or list them")}
            {textField("tunerCheck", "Tuner check", "e.g. key 60 at 432.0 Hz")}
            <div class={fieldClass}>
              <label class={fieldLabelClass} for="studio-lufs">
                Integrated LUFS
              </label>
              <UIInput
                id="studio-lufs"
                type="number"
                step="0.1"
                inputmode="decimal"
                placeholder={String(STUDIO_TARGET_LUFS)}
                value={form().lufs}
                onInput={(event) => set("lufs", event.currentTarget.value)}
              />
            </div>
            <div class={fieldClass}>
              <label class={fieldLabelClass} for="studio-peak">
                True peak (dBTP)
              </label>
              <UIInput
                id="studio-peak"
                type="number"
                step="0.1"
                inputmode="decimal"
                placeholder="-1.0 or lower"
                value={form().peak}
                onInput={(event) => set("peak", event.currentTarget.value)}
              />
            </div>
          </div>
        </fieldset>
        <div class={fieldClass}>
          <label class={fieldLabelClass} for="studio-notes">
            Notes
          </label>
          <UITextarea
            id="studio-notes"
            rows={3}
            maxLength={STUDIO_NOTES_MAX}
            value={form().notes}
            onInput={(event) => set("notes", event.currentTarget.value)}
          />
        </div>
        <p class={helperClass}>
          Loudness is your measurement; the server checks the MP3's format,
          length, SHA-256 and plan, not its loudness.
        </p>
        <UINotice status={status()} error={error()} />
        <div class={actionsClass}>
          <UIButton type="submit" aria-busy={busy()}>
            Upload and open comparison
          </UIButton>
        </div>
      </form>
    </UICard>
  );
}

type MemberScores = Partial<Record<AudioScoreKey, string>>;

// Mounted only with a concrete group id, so every query has real args.
function ComparisonPanel(props: { groupId: Id<"blindGroups"> }) {
  const projection = createQueryWithStatus(api.blindGroups.projection, () => ({
    groupId: props.groupId,
  }));
  const detail = createQueryWithStatus(api.studioComparisons.get, () => ({
    groupId: props.groupId,
  }));
  const submit = createMutation(api.studioComparisons.submitRatings);
  const [scores, setScores] = createSignal<Record<string, MemberScores>>({});
  const [notes, setNotes] = createSignal<Record<string, string>>({});
  const [method, setMethod] = createSignal<Method | "">("");
  const [timeOfDay, setTimeOfDay] = createSignal("");
  const [invalid, setInvalid] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const members = createKeyedRows(
    () =>
      projection
        .data()
        ?.members.toSorted((a, b) => a.label.localeCompare(b.label)),
    (member) => member.memberId,
  );
  const loadError = () => {
    const failure = projection.error() ?? detail.error();
    return failure
      ? `Unable to load this comparison: ${failure.message}`
      : null;
  };
  const fieldId = (memberId: string, key: string) =>
    `comparison-${memberId}-${key}`;
  const headingId = `comparison-${props.groupId}-heading`;

  async function save() {
    if (busy()) return;
    const group = projection.data();
    if (!group) return;
    const payload = [];
    for (const member of group.members.toSorted((a, b) =>
      a.label.localeCompare(b.label),
    )) {
      const parsed: Partial<Record<AudioScoreKey, number>> = {};
      for (const key of RENDER_SCORE_KEYS) {
        const value = parseScore(scores()[member.memberId]?.[key] ?? "");
        if (value === null || (value === undefined && REQUIRED.has(key))) {
          const id = fieldId(member.memberId, key);
          setInvalid(id);
          setError(
            `Take ${member.label}: ${SCORE_LABELS[key]} needs a whole number from 0 to 5.`,
          );
          document.getElementById(id)?.focus();
          return;
        }
        if (value !== undefined) parsed[key] = value;
      }
      const note = notes()[member.memberId]?.trim();
      payload.push({
        memberId: member.memberId,
        scores: parsed,
        ...(note ? { notes: note } : {}),
      });
    }
    const time = timeOfDay().trim();
    if (!method() || !time) {
      setInvalid(method() ? "comparison-time" : "comparison-method");
      setError("Record how and when you listened.");
      document
        .getElementById(method() ? "comparison-time" : "comparison-method")
        ?.focus();
      return;
    }
    setInvalid(null);
    setError(null);
    setBusy(true);
    // The form unmounts on reveal; park focus on the panel heading first.
    document.getElementById(headingId)?.focus();
    try {
      await submit({
        groupId: props.groupId,
        conditions: { listeningMethod: method() as Method, timeOfDay: time },
        members: payload,
      });
      setStatus("Ratings saved. Revealed below.");
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <UICard>
      <h2 id={headingId} tabIndex={-1} class={sectionTitleClass}>
        <Show when={detail.data()} fallback="Studio comparison">
          {(data) => <>Studio comparison: {data().recipeTitle}</>}
        </Show>
      </h2>
      <UINotice error={loadError()} />
      <Show when={projection.data()}>
        {(group) => (
          <div class={stackClass}>
            <UIList class={stackClass}>
              <For each={members.ids()}>
                {(id) => (
                  <Show when={members.byId().get(id)}>
                    {(member) => (
                      <li class={memberClass}>
                        <AudioPlayer
                          src={member().playbackUrl}
                          label={`Take ${member().label}`}
                          durationSecs={member().durationSecs}
                          headingLevel={3}
                          preload="none"
                        />
                        <Show when={!group().revealed}>
                          <fieldset class={fieldsetClass}>
                            <legend class={legendClass}>
                              Take {member().label}: scores, 0 to 5
                            </legend>
                            <div class={scoreGridClass}>
                              <For each={RENDER_SCORE_KEYS}>
                                {(key) => (
                                  <div class={fieldClass}>
                                    <label
                                      class={fieldLabelClass}
                                      for={fieldId(member().memberId, key)}
                                    >
                                      {SCORE_LABELS[key]}
                                      {REQUIRED.has(key) ? "" : " (optional)"}
                                    </label>
                                    <UIInput
                                      id={fieldId(member().memberId, key)}
                                      type="number"
                                      min="0"
                                      max="5"
                                      step="1"
                                      inputmode="numeric"
                                      required={REQUIRED.has(key)}
                                      aria-invalid={
                                        invalid() ===
                                        fieldId(member().memberId, key)
                                          ? "true"
                                          : undefined
                                      }
                                      value={
                                        scores()[member().memberId]?.[key] ?? ""
                                      }
                                      onInput={(event) =>
                                        setScores({
                                          ...scores(),
                                          [member().memberId]: {
                                            ...scores()[member().memberId],
                                            [key]: event.currentTarget.value,
                                          },
                                        })
                                      }
                                    />
                                  </div>
                                )}
                              </For>
                            </div>
                          </fieldset>
                          <div class={fieldClass}>
                            <label
                              class={fieldLabelClass}
                              for={fieldId(member().memberId, "notes")}
                            >
                              Take {member().label} notes
                            </label>
                            <UITextarea
                              id={fieldId(member().memberId, "notes")}
                              rows={2}
                              maxLength={AUDIO_RATING_NOTES_MAX}
                              value={notes()[member().memberId] ?? ""}
                              onInput={(event) =>
                                setNotes({
                                  ...notes(),
                                  [member().memberId]:
                                    event.currentTarget.value,
                                })
                              }
                            />
                          </div>
                        </Show>
                      </li>
                    )}
                  </Show>
                )}
              </For>
            </UIList>
            <Show when={!group().revealed}>
              <fieldset class={fieldsetClass}>
                <legend class={legendClass}>Listening conditions</legend>
                <div class={gridClass}>
                  <div class={fieldClass}>
                    <label class={fieldLabelClass} for="comparison-method">
                      Listened on
                    </label>
                    <UISelect
                      id="comparison-method"
                      value={method()}
                      required
                      aria-invalid={
                        invalid() === "comparison-method" ? "true" : undefined
                      }
                      onChange={(event) =>
                        setMethod(event.currentTarget.value as Method | "")
                      }
                    >
                      <option value="">Choose</option>
                      <For each={METHODS}>
                        {(value) => <option value={value}>{value}</option>}
                      </For>
                    </UISelect>
                  </div>
                  <div class={fieldClass}>
                    <label class={fieldLabelClass} for="comparison-time">
                      Time of day
                    </label>
                    <UIInput
                      id="comparison-time"
                      maxLength={100}
                      placeholder="e.g. evening"
                      required
                      aria-invalid={
                        invalid() === "comparison-time" ? "true" : undefined
                      }
                      value={timeOfDay()}
                      onInput={(event) =>
                        setTimeOfDay(event.currentTarget.value)
                      }
                    />
                  </div>
                </div>
              </fieldset>
              <p class={helperClass}>
                Both takes are saved together and the comparison is revealed at
                once; ratings cannot be changed afterwards.
              </p>
              <div class={actionsClass}>
                <UIButton
                  type="button"
                  aria-busy={busy()}
                  onClick={() => void save()}
                >
                  Save ratings and reveal
                </UIButton>
              </div>
            </Show>
          </div>
        )}
      </Show>
      <UINotice status={status()} error={error()} />
      <Show when={detail.data()?.reveal}>
        {(reveal) => <RevealedProvenance reveal={reveal()} />}
      </Show>
    </UICard>
  );
}

function RevealedProvenance(props: { reveal: NonNullable<Detail["reveal"]> }) {
  const declared = () => props.reveal.declared;
  return (
    <div class={stackClass}>
      <h3 class={sectionTitleClass}>Revealed</h3>
      <UIList class={stackClass}>
        <For each={props.reveal.members}>
          {(member) => (
            <li class={memberClass}>
              <p class={actionsClass}>
                <UIBadge tone="gold">Take {member.label}</UIBadge>
                <UIBadge tone="cream">
                  {member.source === "studio"
                    ? "studio render"
                    : "machine render"}
                </UIBadge>
                <span class={metaLine}>
                  {member.engineName} {member.engineVersion}
                </span>
              </p>
              <Show when={member.rating}>
                {(rating) => (
                  <dl class={definitionClass}>
                    <For
                      each={RENDER_SCORE_KEYS.filter(
                        (key) => rating().scores[key] !== undefined,
                      )}
                    >
                      {(key) => (
                        <div>
                          <dt>{SCORE_LABELS[key]}</dt>
                          <dd>{rating().scores[key]}</dd>
                        </div>
                      )}
                    </For>
                    <Show when={rating().notes}>
                      {(text) => (
                        <div>
                          <dt>Notes</dt>
                          <dd>{text()}</dd>
                        </div>
                      )}
                    </Show>
                  </dl>
                )}
              </Show>
            </li>
          )}
        </For>
      </UIList>
      <h3 class={sectionTitleClass}>Provenance</h3>
      <dl class={definitionClass}>
        <div>
          <dt>Studio host</dt>
          <dd>{declared().daw}</dd>
        </div>
        <div>
          <dt>Instrument and patch</dt>
          <dd>{declared().instrument}</dd>
        </div>
        <div>
          <dt>Tuning method</dt>
          <dd>
            {TUNING_LABELS[declared().tuningMethod as StudioTuningMethod] ??
              declared().tuningMethod}
          </dd>
        </div>
        <div>
          <dt>Effects</dt>
          <dd>{declared().effects}</dd>
        </div>
        <div>
          <dt>Tuner check</dt>
          <dd>{declared().tunerCheck}</dd>
        </div>
        <div>
          <dt>Declared loudness</dt>
          <dd>
            {declared().integratedLufs} LUFS, {declared().truePeakDbtp} dBTP
          </dd>
        </div>
        <div>
          <dt>Studio SHA-256</dt>
          <dd>{props.reveal.studioSha256}</dd>
        </div>
        <div>
          <dt>Plan digest</dt>
          <dd>{props.reveal.planDigest}</dd>
        </div>
        <div>
          <dt>Recipe revision</dt>
          <dd>
            <DateTime value={props.reveal.recipeUpdatedAt} format="datetime" />
          </dd>
        </div>
        <div>
          <dt>Machine renderer</dt>
          <dd>{props.reveal.machineRendererVersion}</dd>
        </div>
        <Show when={props.reveal.conditions}>
          {(conditions) => (
            <div>
              <dt>Listened</dt>
              <dd>
                {conditions().listeningMethod}, {conditions().timeOfDay}
              </dd>
            </div>
          )}
        </Show>
        <Show when={declared().notes}>
          {(text) => (
            <div>
              <dt>Studio notes</dt>
              <dd>{text()}</dd>
            </div>
          )}
        </Show>
      </dl>
    </div>
  );
}
