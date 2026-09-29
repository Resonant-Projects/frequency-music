import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import { AudioPlayer } from "../components/audio-player";
import {
  fieldLabelClass,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UINotice,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";

const RATING_KEYS = [
  "naturalness",
  "prosody",
  "clean",
  "clarity",
  "overall",
] as const;
type RatingKey = (typeof RATING_KEYS)[number];
const RATING_LABELS: Record<RatingKey, string> = {
  naturalness: "Naturalness",
  prosody: "Prosody",
  clean: "Clean (5 = no artifacts)",
  clarity: "Clarity",
  overall: "Overall",
};

type MemberForm = Record<RatingKey, string> & { notes: string };
// Ratings start empty so every score is a deliberate choice; a blank field
// is refused rather than read as 0 (Number("") is 0).
const EMPTY_FORM: MemberForm = {
  naturalness: "",
  prosody: "",
  clean: "",
  clarity: "",
  overall: "",
  notes: "",
};
const RATING_REQUIRED = "Every rating needs a whole number from 0 to 5.";

function parseRating(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : null;
}

const proseClass = css({ color: "zodiac.cream/66" });
const bannerClass = css({ color: "zodiac.cream/82", mt: "2" });
const listClass = css({ display: "flex", flexDirection: "column", gap: "1" });
const rowButtonClass = css({
  bg: "transparent",
  border: "none",
  color: "zodiac.cream/82",
  cursor: "pointer",
  display: "flex",
  gap: "2",
  alignItems: "center",
  py: "1",
  textAlign: "left",
  _hover: { color: "zodiac.cream" },
  "&[aria-current='true']": { color: "zodiac.gold" },
});
const ratingGridClass = css({
  display: "grid",
  gridTemplateColumns: { base: "repeat(2, 1fr)", md: "repeat(5, 1fr)" },
  gap: "3",
  mt: "3",
});
const fieldClass = css({ display: "flex", flexDirection: "column", gap: "1" });
const actionsClass = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "3",
  alignItems: "center",
  mt: "3",
});

export function ListenPage() {
  onMount(() => {
    document.title = "Listen — Frequency Music";
  });
  // Status-bearing queries: a failed query must read as a failure, not as
  // "no shootouts yet" or "not chosen".
  const shootouts = createQueryWithStatus(api.listen.shootouts, () => ({}));
  const houseVoice = createQueryWithStatus(api.settings.houseVoice, () => ({}));
  const [groupId, setGroupId] = createSignal<Id<"blindGroups"> | null>(null);
  // Latch the first shootout once; tracking row 0 would jump to a newer
  // shootout mid-rating and remount the group, discarding the form.
  createEffect(() => {
    const first = shootouts.data()?.[0]?.groupId;
    if (groupId() === null && first) setGroupId(first);
  });
  const selected = groupId;
  const shootoutsStatus = () => {
    if (shootouts.isLoading()) return "Loading shootouts...";
    if (shootouts.error() || (shootouts.data() ?? []).length > 0) return null;
    return "No shootouts yet.";
  };
  const shootoutsError = () =>
    shootouts.error()
      ? `Unable to load shootouts: ${shootouts.error()?.message}`
      : null;
  const houseVoiceLabel = () => {
    if (houseVoice.isLoading()) return "loading...";
    if (houseVoice.error()) return "unavailable";
    return houseVoice.data()?.voiceId ?? "not chosen";
  };
  const houseVoiceError = () =>
    houseVoice.error()
      ? `Unable to load the house voice: ${houseVoice.error()?.message}`
      : null;
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const report = (text: string, isError = false) => {
    setNotice(isError ? null : text);
    setNoticeError(isError ? text : null);
  };

  return (
    <section class={pageClass}>
      <UICard>
        <h1 class={pageTitleClass}>Listen</h1>
        <p class={proseClass}>
          Blind voice shootout. Rate every take; the mapping is revealed only
          after the last rating. Choosing the house voice is a separate,
          explicit step.
        </p>
        <p class={bannerClass}>House voice: {houseVoiceLabel()}</p>
        <UINotice error={houseVoiceError()} />
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Shootouts</h2>
        <UINotice status={shootoutsStatus()} error={shootoutsError()} />
        <Show when={(shootouts.data()?.length ?? 0) > 0}>
          <div class={listClass}>
            <For each={shootouts.data() ?? []}>
              {(row) => (
                <button
                  type="button"
                  class={rowButtonClass}
                  aria-current={selected() === row.groupId ? "true" : undefined}
                  onClick={() => setGroupId(row.groupId)}
                >
                  <span>
                    {new Date(row.createdAt).toLocaleString()} ·{" "}
                    {row.memberCount} takes
                  </span>
                  <Show when={row.revealed}>
                    <UIBadge tone="violet">revealed</UIBadge>
                  </Show>
                  <Show when={row.episodeArtifactId}>
                    <UIBadge tone="cream">episode</UIBadge>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </UICard>

      <UINotice status={notice()} error={noticeError()} />

      <Show when={selected()} keyed>
        {(id) => <ShootoutGroup groupId={id} onNotice={report} />}
      </Show>
    </section>
  );
}

// Mounted only with a concrete group id, so every query has real args.
function ShootoutGroup(props: {
  groupId: Id<"blindGroups">;
  onNotice: (text: string, isError?: boolean) => void;
}) {
  const projectionQuery = createQueryWithStatus(
    api.blindGroups.projection,
    () => ({ groupId: props.groupId }),
  );
  const ratingsQuery = createQueryWithStatus(api.voiceRatings.forGroup, () => ({
    groupId: props.groupId,
  }));
  const projection = projectionQuery.data;
  const ratings = ratingsQuery.data;
  // A failed subscription must read as a failure, not as an empty group.
  const groupError = () => {
    const error = projectionQuery.error() ?? ratingsQuery.error();
    return error ? `Unable to load this shootout: ${error.message}` : null;
  };
  const submit = createMutation(api.voiceRatings.submit);
  const setHouseVoice = createMutation(api.settings.setHouseVoice);
  const [form, setForm] = createSignal<Record<string, MemberForm>>({});

  const formFor = (memberId: string) => form()[memberId] ?? EMPTY_FORM;
  const update = (memberId: string, key: keyof MemberForm, value: string) =>
    setForm({ ...form(), [memberId]: { ...formFor(memberId), [key]: value } });
  const ratedIds = createMemo(
    () => new Set((ratings() ?? []).map((row) => row.memberId)),
  );
  const ratingFor = (memberId: string) =>
    (ratings() ?? []).find((row) => row.memberId === memberId);

  async function rate(memberId: string) {
    const values = formFor(memberId);
    const parsed: Partial<Record<RatingKey, number>> = {};
    for (const key of RATING_KEYS) {
      const value = parseRating(values[key]);
      if (value === null) {
        props.onNotice(`${RATING_REQUIRED} (${RATING_LABELS[key]})`, true);
        return;
      }
      parsed[key] = value;
    }
    try {
      const result = await submit({
        groupId: props.groupId,
        memberId,
        ratings: parsed as Record<RatingKey, number>,
        notes: values.notes.trim() || undefined,
      });
      props.onNotice(
        result.revealed
          ? "All takes rated. Revealed below."
          : `${result.remaining} take(s) left to rate.`,
      );
    } catch (error) {
      props.onNotice(
        error instanceof Error ? error.message : "Rating failed",
        true,
      );
    }
  }

  async function chooseHouseVoice(voiceId: string) {
    try {
      await setHouseVoice({ voiceId });
      props.onNotice(`House voice set to ${voiceId}`);
    } catch (error) {
      props.onNotice(
        error instanceof Error ? error.message : "Could not set house voice",
        true,
      );
    }
  }

  return (
    <>
      <UINotice status={null} error={groupError()} />
      <Show when={projection()}>
        {(group) => (
          <For each={group().members}>
            {(member) => (
              <UICard>
                <AudioPlayer
                  src={member.playbackUrl}
                  label={member.label}
                  durationSecs={member.durationSecs}
                />
                <Show
                  when={!group().revealed && !ratedIds().has(member.memberId)}
                >
                  <div class={ratingGridClass}>
                    <For each={RATING_KEYS}>
                      {(key) => (
                        <div class={fieldClass}>
                          <label
                            class={fieldLabelClass}
                            for={`rating-${member.memberId}-${key}`}
                          >
                            {RATING_LABELS[key]} (0-5)
                          </label>
                          <UIInput
                            id={`rating-${member.memberId}-${key}`}
                            type="number"
                            min="0"
                            max="5"
                            step="1"
                            required
                            placeholder="0-5"
                            inputmode="numeric"
                            value={formFor(member.memberId)[key]}
                            onInput={(event) =>
                              update(
                                member.memberId,
                                key,
                                event.currentTarget.value,
                              )
                            }
                          />
                        </div>
                      )}
                    </For>
                  </div>
                  <div class={actionsClass}>
                    <UIInput
                      placeholder="Notes"
                      aria-label="Notes"
                      value={formFor(member.memberId).notes}
                      onInput={(event) =>
                        update(
                          member.memberId,
                          "notes",
                          event.currentTarget.value,
                        )
                      }
                    />
                    <UIButton
                      type="button"
                      onClick={() => rate(member.memberId)}
                    >
                      Save rating
                    </UIButton>
                  </div>
                </Show>
                <Show
                  when={ratedIds().has(member.memberId) && !group().revealed}
                >
                  <div class={actionsClass}>
                    <UIBadge>rated</UIBadge>
                  </div>
                </Show>
                <Show when={group().revealed}>
                  <div class={actionsClass}>
                    <UIBadge tone="violet">
                      {ratingFor(member.memberId)?.voiceId ?? "unrated"}
                    </UIBadge>
                    <Show when={ratingFor(member.memberId)?.voiceId}>
                      {(voiceId) => (
                        <UIButton
                          type="button"
                          variant="solid"
                          onClick={() => chooseHouseVoice(voiceId())}
                        >
                          Set as house voice
                        </UIButton>
                      )}
                    </Show>
                  </div>
                </Show>
              </UICard>
            )}
          </For>
        )}
      </Show>
    </>
  );
}
