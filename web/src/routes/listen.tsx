import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  onCleanup,
  Show,
} from "solid-js";
import { useSearch } from "@tanstack/solid-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { createKeyedRows } from "../lib/keyed-rows";
import { AudioFeedbackQueue } from "../components/audio-feedback";
import { AudioPlayer } from "../components/audio-player";
import { parsePodcastFeed, type PodcastEpisode } from "../lib/podcast-feed";
import {
  DateTime,
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
} from "../components/ui";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";

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
  clean: "Clean",
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

type TakeFeedback = {
  status: string | null;
  error: string | null;
  field: RatingKey | null;
};
const NO_FEEDBACK: TakeFeedback = { status: null, error: null, field: null };

// Listener-facing names for the catalog ids in convex/shared/voices.ts. An id
// missing here (a voice added later) falls back to the raw id.
const VOICE_NAMES: Record<string, string> = {
  "gemini-flash-tts": "Gemini Flash (Charon)",
  "inworld-max": "Inworld Max (Dennis)",
  "elevenlabs-v3": "ElevenLabs v3",
  "breeze-2": "Breeze 2 (local)",
  "cartesia-sonic-nandi": "Cartesia Sonic (Nandi)",
  "cartesia-sonic-quentin": "Cartesia Sonic (Quentin)",
};
const voiceName = (voiceId: string | null | undefined, unset = "unrated") =>
  voiceId ? (VOICE_NAMES[voiceId] ?? voiceId) : unset;

// Episodes after the first few load nothing until played, so a long feed does
// not fetch metadata for every file on page load.
const EAGER_EPISODES = 3;

const SHOOTOUT_GROUP_ID = "shootout-group";

function parseRating(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : null;
}

const bannerClass = css({ color: "zodiac.cream/82", mt: "2" });
const listClass = css({ display: "flex", flexDirection: "column", gap: "1" });
// The selected shootout carries a gold left rule as well as gold text, so the
// selection never depends on colour alone (WCAG 1.4.1). The focus ring is the
// global `button:focus-visible` default.
const rowButtonClass = css({
  alignItems: "center",
  bg: "transparent",
  borderLeftColor: "transparent",
  borderLeftWidth: "2px",
  color: "zodiac.cream/82",
  cursor: "pointer",
  display: "flex",
  flexWrap: "wrap",
  gap: "2",
  minH: "9",
  pl: "2",
  py: "1",
  textAlign: "left",
  w: "full",
  _hover: { color: "zodiac.cream" },
  _coarsePointer: { minH: "11" },
  "&[aria-pressed='true']": {
    borderLeftColor: "zodiac.gold",
    color: "zodiac.gold",
  },
});
const groupSlotClass = css({ display: "contents" });
const episodesHeaderClass = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "3",
  justifyContent: "space-between",
  alignItems: "center",
});
const episodeClass = css({
  py: "5",
  borderBottomWidth: "1px",
  borderColor: "zodiac.gold/22",
  _last: { borderBottom: "none", pb: "0" },
});
const episodeDateClass = css({ color: "zodiac.cream/66", mt: "2" });
const ratingGridClass = css({
  display: "grid",
  gridTemplateColumns: {
    base: "repeat(2, minmax(0, 1fr))",
    md: "repeat(3, minmax(0, 1fr))",
    lg: "repeat(5, minmax(0, 1fr))",
  },
  gap: "3",
  mt: "3",
});
const ratingHelpClass = cx(helperClass, css({ mt: "2" }));
const fieldClass = css({ display: "flex", flexDirection: "column", gap: "1" });
const actionsClass = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "3",
  alignItems: "center",
  mt: "3",
});
const stepsClass = css({
  color: "zodiac.cream/82",
  display: "flex",
  flexDirection: "column",
  gap: "1",
  listStyle: "decimal",
  mt: "3",
  pl: "5",
});
const copyRowClass = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "3",
  alignItems: "center",
  "& > input": { flex: "[1 1 16rem]", minW: "0" },
});

// The house voice's first choice schedules a reconcile over this window.
const NARRATION_BACKFILL_DAYS = 14;

type FeedNotConfiguredReason =
  | "missing_token"
  | "invalid_token"
  | "invalid_base_url";
// Plain copy for the listener; the operator-facing detail for each reason
// lives with the feed configuration, not in this flow.
const FEED_NOT_CONFIGURED: Record<FeedNotConfiguredReason, string> = {
  missing_token: "The private feed isn't set up yet. Check back later.",
  invalid_token:
    "The private feed is set up incorrectly, so there is no address to share yet.",
  invalid_base_url:
    "The private feed is set up incorrectly, so there is no address to share yet.",
};

export function ListenPage() {
  // Docket cards link here with ?audio=<artifactId>.
  const search = useSearch({ strict: false }) as () => { audio?: unknown };
  const focusAudio = () => {
    const value = search().audio;
    return typeof value === "string" && value ? value : undefined;
  };
  onMount(() => {
    document.title = "Listen — Frequency Music";
  });
  // Status-bearing queries: a failed query must read as a failure, not as
  // "no shootouts yet" or "not chosen".
  const shootouts = createQueryWithStatus(api.listen.shootouts, () => ({}));
  // Keyed by group so a refresh (a reveal, a new shootout) keeps the pressed
  // row button mounted.
  const shootoutRows = createKeyedRows(
    () => shootouts.data(),
    (row) => String(row.groupId),
  );
  const subscription = createQueryWithStatus(
    api.podcast.subscription,
    () => ({}),
  );
  const houseVoice = createQueryWithStatus(api.settings.houseVoice, () => ({}));
  const [groupId, setGroupId] = createSignal<Id<"blindGroups"> | null>(null);
  // Latch the first shootout once; tracking row 0 would jump to a newer
  // shootout mid-rating and remount the group, discarding the form.
  createEffect(() => {
    const first = shootouts.data()?.[0]?.groupId;
    if (groupId() === null && first) setGroupId(first);
  });
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
    return voiceName(houseVoice.data()?.voiceId, "not chosen");
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
        <p class={helperClass}>
          Listen to the episodes in your private podcast feed here, or subscribe
          in your podcast app. New weekly briefs use your chosen house voice.
        </p>
        <p class={bannerClass}>House voice: {houseVoiceLabel()}</p>
        <UINotice error={houseVoiceError()} />
      </UICard>

      <AudioFeedbackQueue focusId={focusAudio()} />

      <Show
        when={(() => {
          const feed = subscription.data();
          return feed?.configured ? feed.feedUrl : null;
        })()}
      >
        {(url) => <PodcastEpisodes feedUrl={url()} />}
      </Show>

      <PodcastFeedCard subscription={subscription} />

      <UICard>
        <h2 class={sectionTitleClass}>Voice shootouts</h2>
        <p class={helperClass}>
          Rate every take to reveal the voices. Choosing a house voice is a
          separate step; your first choice also narrates briefs from the last{" "}
          {NARRATION_BACKFILL_DAYS} days.
        </p>
        <UINotice status={shootoutsStatus()} error={shootoutsError()} />
        <Show when={(shootouts.data()?.length ?? 0) > 0}>
          <UIList class={listClass}>
            <For each={shootoutRows.ids()}>
              {(id) => (
                <Show when={shootoutRows.byId().get(id)}>
                  {(row) => (
                    <li>
                      <button
                        type="button"
                        class={rowButtonClass}
                        aria-pressed={groupId() === row().groupId}
                        aria-controls={SHOOTOUT_GROUP_ID}
                        onClick={() => setGroupId(row().groupId)}
                      >
                        <span>
                          <DateTime value={row().createdAt} format="datetime" />{" "}
                          · {row().memberCount} takes
                        </span>
                        <Show when={row().revealed}>
                          <UIBadge tone="gold">revealed</UIBadge>
                        </Show>
                        <Show when={row().episodeArtifactId}>
                          <UIBadge tone="cream">episode</UIBadge>
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

      <UINotice status={notice()} error={noticeError()} />

      {/* Always mounted so the shootout buttons' aria-controls resolves;
          display: contents keeps its children on the page grid. */}
      <div id={SHOOTOUT_GROUP_ID} class={groupSlotClass}>
        <Show when={groupId()} keyed>
          {(id) => (
            <ShootoutGroup
              groupId={id}
              createdAt={
                shootouts.data()?.find((row) => row.groupId === id)?.createdAt
              }
              houseVoiceId={houseVoice.data()?.voiceId ?? null}
              onNotice={report}
            />
          )}
        </Show>
      </div>
    </section>
  );
}

function PodcastEpisodes(props: { feedUrl: string }) {
  const [episodes, setEpisodes] = createSignal<PodcastEpisode[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let activeRequest: AbortController | null = null;
  let disposed = false;

  async function refresh() {
    if (activeRequest || disposed) return;
    const controller = new AbortController();
    activeRequest = controller;
    setLoading(true);
    setError(null);
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      // Same-origin proxy to the RSS host. The authenticated subscription
      // query is the sole source of the token; no cookie or auth key is sent.
      const response = await fetch(new URL(props.feedUrl).pathname, {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Feed unavailable");
      const next = parsePodcastFeed(await response.text(), props.feedUrl);
      if (!disposed) {
        // Keep existing row objects so a routine feed refresh does not
        // remount the native player and interrupt a long episode.
        setEpisodes((previous) =>
          next.map(
            (episode) =>
              previous.find(
                (row) =>
                  row.id === episode.id &&
                  row.title === episode.title &&
                  row.playbackUrl === episode.playbackUrl &&
                  row.createdAt === episode.createdAt &&
                  row.durationSecs === episode.durationSecs,
              ) ?? episode,
          ),
        );
        setLoaded(true);
      }
    } catch {
      if (!disposed)
        setError(
          "Unable to refresh episodes. Try again using Refresh episodes.",
        );
    } finally {
      clearTimeout(timeout);
      activeRequest = null;
      if (!disposed) setLoading(false);
    }
  }

  onMount(() => {
    void refresh();
    // Refresh only while visible, and immediately when the listener returns.
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = setInterval(refreshIfVisible, 60000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    onCleanup(() => {
      disposed = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      activeRequest?.abort();
    });
  });

  return (
    <UICard>
      <div class={episodesHeaderClass}>
        <h2 class={sectionTitleClass}>Episodes</h2>
        {/* aria-busy, not disabled: the 60 s poll would otherwise blur the
            button out from under a keyboard user; refresh() ignores repeats. */}
        <UIButton
          type="button"
          variant="outline"
          aria-busy={loading()}
          onClick={() => void refresh()}
        >
          Refresh episodes
        </UIButton>
      </div>
      <p class={helperClass}>
        The same episodes as your RSS feed, newest first.
      </p>
      <UINotice
        status={
          loading() && !loaded()
            ? "Loading episodes..."
            : loaded() && !episodes().length
              ? "No episodes yet. Published episodes will appear here and in your podcast app."
              : null
        }
        error={error()}
      />
      <UIList as="ol">
        <For each={episodes()}>
          {(episode, index) => (
            <li class={episodeClass}>
              <AudioPlayer
                src={episode.playbackUrl}
                label={episode.title}
                durationSecs={episode.durationSecs}
                headingLevel={3}
                preload={index() < EAGER_EPISODES ? "metadata" : "none"}
              />
              <p class={episodeDateClass}>
                <DateTime value={episode.createdAt} />
              </p>
            </li>
          )}
        </For>
      </UIList>
    </UICard>
  );
}

// The feed address is a bearer credential. It is fetched only through the
// authenticated query and lives nowhere but this card.
function PodcastFeedCard(props: {
  subscription: ReturnType<
    typeof createQueryWithStatus<typeof api.podcast.subscription>
  >;
}) {
  const subscription = props.subscription;
  const [copyStatus, setCopyStatus] = createSignal<string | null>(null);
  const [copyError, setCopyError] = createSignal<string | null>(null);
  let urlInput: HTMLInputElement | undefined;

  const feedUrl = () => {
    const data = subscription.data();
    return data?.configured ? data.feedUrl : null;
  };
  const status = () => {
    if (copyStatus()) return copyStatus();
    if (subscription.isLoading()) return "Loading the feed address...";
    const data = subscription.data();
    return data && !data.configured ? FEED_NOT_CONFIGURED[data.reason] : null;
  };
  const error = () => {
    if (copyError()) return copyError();
    const failure = subscription.error();
    return failure
      ? `Unable to load the feed address: ${failure.message}`
      : null;
  };

  async function copy(url: string) {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setCopyError(null);
      setCopyStatus("Feed address copied.");
    } catch {
      // Clipboard access can be denied or absent; leave the address
      // selected so a manual copy is one keystroke away.
      urlInput?.focus();
      urlInput?.select();
      setCopyStatus(null);
      setCopyError(
        "Could not copy automatically. The address is selected above; copy it manually.",
      );
    }
  }

  return (
    <UICard>
      <h2 class={sectionTitleClass}>Podcast feed</h2>
      <p class={helperClass}>
        Episodes arrive as a private podcast. Anyone with this address can
        listen, so keep it to yourself.
      </p>
      <Show when={feedUrl()}>
        {(url) => (
          <>
            <ol class={stepsClass}>
              <li>Copy the feed address below.</li>
              <li>
                In Pocket Casts, open Discover and paste the full address into
                search.
              </li>
              <li>Open the result and tap Subscribe.</li>
            </ol>
            <label class={fieldLabelClass} for="podcast-feed-url">
              Private feed address
            </label>
            <div class={copyRowClass}>
              <UIInput
                id="podcast-feed-url"
                ref={(el) => {
                  urlInput = el;
                }}
                readOnly
                spellcheck={false}
                autocomplete="off"
                value={url()}
                onFocus={(event) => event.currentTarget.select()}
              />
              <UIButton type="button" onClick={() => copy(url())}>
                Copy address
              </UIButton>
            </div>
          </>
        )}
      </Show>
      <UINotice status={status()} error={error()} />
    </UICard>
  );
}

// Mounted only with a concrete group id, so every query has real args.
function ShootoutGroup(props: {
  groupId: Id<"blindGroups">;
  createdAt?: number;
  houseVoiceId: string | null;
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
  // Both outcomes of rating a take sit beside the take, not at the top of
  // the page; `field` is the rating input that failed validation.
  const [feedback, setFeedback] = createSignal<Record<string, TakeFeedback>>(
    {},
  );
  const [savingId, setSavingId] = createSignal<string | null>(null);

  const formFor = (memberId: string) => form()[memberId] ?? EMPTY_FORM;
  const feedbackFor = (memberId: string) => feedback()[memberId] ?? NO_FEEDBACK;
  const setTakeFeedback = (memberId: string, next: Partial<TakeFeedback>) =>
    setFeedback((all) => ({
      ...all,
      [memberId]: { ...(all[memberId] ?? NO_FEEDBACK), ...next },
    }));
  const update = (memberId: string, key: keyof MemberForm, value: string) => {
    setForm({ ...form(), [memberId]: { ...formFor(memberId), [key]: value } });
    if (feedbackFor(memberId).field === key)
      setTakeFeedback(memberId, { field: null });
  };
  const ratedIds = createMemo(
    () => new Set((ratings() ?? []).map((row) => row.memberId)),
  );
  const ratingFor = (memberId: string) =>
    (ratings() ?? []).find((row) => row.memberId === memberId);
  const fieldId = (memberId: string, key: RatingKey) =>
    `rating-${memberId}-${key}`;
  const takeHeadingId = (memberId: string) => `take-${memberId}-heading`;
  const helpId = (memberId: string) => `rating-${memberId}-help`;
  const headingId = `shootout-${props.groupId}-heading`;

  async function rate(memberId: string, trigger: HTMLButtonElement) {
    if (savingId() !== null) return;
    const values = formFor(memberId);
    const parsed: Partial<Record<RatingKey, number>> = {};
    for (const key of RATING_KEYS) {
      const value = parseRating(values[key]);
      if (value === null) {
        setTakeFeedback(memberId, {
          status: null,
          error: `${RATING_REQUIRED} (${RATING_LABELS[key]})`,
          field: key,
        });
        document.getElementById(fieldId(memberId, key))?.focus();
        return;
      }
      parsed[key] = value;
    }
    setTakeFeedback(memberId, NO_FEEDBACK);
    setSavingId(memberId);
    // A saved rating unmounts this form (and the last one reveals the group),
    // so park focus on the take's heading before the swap rather than letting
    // it fall to <body>.
    document.getElementById(takeHeadingId(memberId))?.focus();
    try {
      const result = await submit({
        groupId: props.groupId,
        memberId,
        ratings: parsed as Record<RatingKey, number>,
        notes: values.notes.trim() || undefined,
      });
      setTakeFeedback(memberId, {
        status: result.revealed
          ? "All takes rated. Revealed below."
          : `${result.remaining} take(s) left to rate.`,
      });
    } catch (error) {
      setTakeFeedback(memberId, { error: describeError(error) });
      if (trigger.isConnected) trigger.focus();
    } finally {
      setSavingId(null);
    }
  }

  // One choice in flight at a time; the server also schedules the initial
  // narration only once, however often this is clicked.
  const [choosing, setChoosing] = createSignal(false);
  async function chooseHouseVoice(voiceId: string) {
    if (choosing()) return;
    setChoosing(true);
    const name = voiceName(voiceId);
    try {
      const { initialNarrationScheduled } = await setHouseVoice({ voiceId });
      props.onNotice(
        initialNarrationScheduled
          ? `House voice set to ${name}. Narration of briefs from the last ${NARRATION_BACKFILL_DAYS} days is starting; episodes appear in the feed as they finish.`
          : `House voice set to ${name}. New briefs will be narrated in this voice.`,
      );
    } catch (error) {
      props.onNotice(describeError(error), true);
    } finally {
      setChoosing(false);
    }
  }

  return (
    <>
      <h3 id={headingId} class={sectionTitleClass}>
        <Show when={props.createdAt} fallback="Shootout">
          {(createdAt) => (
            <>
              Shootout from <DateTime value={createdAt()} format="datetime" />
            </>
          )}
        </Show>
      </h3>
      <UINotice error={groupError()} />
      <Show when={projection()}>
        {(group) => {
          // Keyed by memberId: the reveal projection delivers fresh member
          // objects, and the take heading holding focus must survive it.
          const members = createKeyedRows(
            () => group().members,
            (member) => member.memberId,
          );
          return (
            <For each={members.ids()}>
              {(id) => (
                <Show when={members.byId().get(id)}>
                  {(member) => (
                    <UICard>
                      <AudioPlayer
                        src={member().playbackUrl}
                        label={member().label}
                        durationSecs={member().durationSecs}
                        headingLevel={4}
                        headingId={takeHeadingId(member().memberId)}
                      />
                      <Show
                        when={
                          !group().revealed &&
                          !ratedIds().has(member().memberId)
                        }
                      >
                        <div class={ratingGridClass}>
                          <For each={RATING_KEYS}>
                            {(key) => (
                              <div class={fieldClass}>
                                <label
                                  class={fieldLabelClass}
                                  for={fieldId(member().memberId, key)}
                                >
                                  {RATING_LABELS[key]} (0-5)
                                </label>
                                <UIInput
                                  id={fieldId(member().memberId, key)}
                                  type="number"
                                  min="0"
                                  max="5"
                                  step="1"
                                  placeholder="0-5"
                                  inputmode="numeric"
                                  aria-invalid={
                                    feedbackFor(member().memberId).field === key
                                      ? "true"
                                      : undefined
                                  }
                                  aria-describedby={
                                    key === "clean"
                                      ? helpId(member().memberId)
                                      : undefined
                                  }
                                  value={formFor(member().memberId)[key]}
                                  onInput={(event) =>
                                    update(
                                      member().memberId,
                                      key,
                                      event.currentTarget.value,
                                    )
                                  }
                                />
                              </div>
                            )}
                          </For>
                        </div>
                        <p
                          id={helpId(member().memberId)}
                          class={ratingHelpClass}
                        >
                          Clean: 5 means no artifacts.
                        </p>
                        <div class={actionsClass}>
                          <UIInput
                            placeholder="Notes"
                            aria-label="Notes"
                            value={formFor(member().memberId).notes}
                            onInput={(event) =>
                              update(
                                member().memberId,
                                "notes",
                                event.currentTarget.value,
                              )
                            }
                          />
                          <UIButton
                            type="button"
                            aria-busy={savingId() === member().memberId}
                            onClick={(event) =>
                              rate(member().memberId, event.currentTarget)
                            }
                          >
                            Save rating
                          </UIButton>
                        </div>
                      </Show>
                      <UINotice
                        status={feedbackFor(member().memberId).status}
                        error={feedbackFor(member().memberId).error}
                      />
                      <Show
                        when={
                          ratedIds().has(member().memberId) && !group().revealed
                        }
                      >
                        <div class={actionsClass}>
                          <UIBadge>rated</UIBadge>
                        </div>
                      </Show>
                      <Show when={group().revealed}>
                        <div class={actionsClass}>
                          <UIBadge tone="cream">
                            {voiceName(ratingFor(member().memberId)?.voiceId)}
                          </UIBadge>
                          <Show when={ratingFor(member().memberId)?.voiceId}>
                            {(voiceId) => (
                              <>
                                {/* The current voice stays selectable: a voice
                              seeded internally still needs the first human
                              choice to start the initial narration. */}
                                <Show when={voiceId() === props.houseVoiceId}>
                                  <UIBadge>house voice</UIBadge>
                                </Show>
                                <UIButton
                                  type="button"
                                  aria-busy={choosing()}
                                  onClick={() => chooseHouseVoice(voiceId())}
                                >
                                  Set as house voice
                                </UIButton>
                              </>
                            )}
                          </Show>
                        </div>
                      </Show>
                    </UICard>
                  )}
                </Show>
              )}
            </For>
          );
        }}
      </Show>
    </>
  );
}
