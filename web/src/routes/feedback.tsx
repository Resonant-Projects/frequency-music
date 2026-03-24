import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
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
  UITextarea,
} from "../components/ui";
import { withDevBypassSecret } from "../integrations/authBypass";
import {
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";

function parseParticipants(input: string) {
  return input
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, role: "collaborator" }));
}

function parseCommaSeparated(input: string) {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseLineSeparated(input: string) {
  return input
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseOptionalRating(input: string) {
  const value = input.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function truncate(text: string, maxLength: number) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function FeedbackPage() {
  onMount(() => { document.title = "Feedback — Frequency Music"; });

  const compositions = createQuery(convexApi.compositions.list, () => ({
    limit: 40,
  }));
  const sessions = createQueryWithStatus(
    convexApi.listening.listRecent,
    () => ({
      limit: 30,
    }),
  );
  const createSession = createMutation(convexApi.listening.create);

  const compositionById = createMemo(() => {
    const lookup = new Map<string, string>();
    for (const composition of compositions() ?? []) {
      lookup.set(String(composition._id), composition.title);
    }
    return lookup;
  });

  const [compositionId, setCompositionId] = createSignal("");
  const [participants, setParticipants] = createSignal("");
  const [contextMd, setContextMd] = createSignal("");
  const [feedbackMd, setFeedbackMd] = createSignal("");
  const [pleasantness, setPleasantness] = createSignal("3");
  const [goosebumps, setGoosebumps] = createSignal("2");
  const [musicality, setMusicality] = createSignal("3");
  const [expandability, setExpandability] = createSignal("");
  const [feltQualities, setFeltQualities] = createSignal("");
  const [bodyMapTags, setBodyMapTags] = createSignal("");
  const [standoutMoments, setStandoutMoments] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);

  async function submitSession(event: SubmitEvent) {
    event.preventDefault();

    if (!compositionId() || !feedbackMd().trim()) {
      setNotice("Composition and feedback are required.");
      return;
    }

    try {
      const parsedFeltQualities = parseCommaSeparated(feltQualities());
      const parsedBodyMapTags = parseCommaSeparated(bodyMapTags());
      const parsedStandoutMoments = parseLineSeparated(standoutMoments());

      setNotice(null);
      await createSession(
        withDevBypassSecret({
          compositionId: compositionId() as Id<"compositions">,
          participants: parseParticipants(participants()),
          contextMd: contextMd().trim() || undefined,
          feedbackMd: feedbackMd().trim(),
          ratings: {
            bodilyPleasantness: Number(pleasantness()),
            goosebumps: Number(goosebumps()),
            musicality: Number(musicality()),
            expandability: parseOptionalRating(expandability()),
          },
          feltQualities:
            parsedFeltQualities.length > 0 ? parsedFeltQualities : undefined,
          bodyMapTags:
            parsedBodyMapTags.length > 0 ? parsedBodyMapTags : undefined,
          standoutMoments:
            parsedStandoutMoments.length > 0
              ? parsedStandoutMoments
              : undefined,
        }),
      );

      setParticipants("");
      setContextMd("");
      setFeedbackMd("");
      setExpandability("");
      setFeltQualities("");
      setBodyMapTags("");
      setStandoutMoments("");
      setNotice("Listening session logged.");
    } catch (error) {
      setNotice(`Failed to log session: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard as="form" onSubmit={submitSession}>
        <h1 class={pageTitleClass}>Feedback & Listening Sessions</h1>

        <label class={fieldLabelClass} for="feedback-composition">
          Composition
        </label>
        <UISelect
          id="feedback-composition"
          value={compositionId()}
          onChange={(event) => setCompositionId(event.currentTarget.value)}
        >
          <option value="">Select composition</option>
          <For each={compositions() ?? []}>
            {(item: Doc<"compositions">) => (
              <option value={String(item._id)}>{item.title}</option>
            )}
          </For>
        </UISelect>

        <label class={fieldLabelClass} for="feedback-participants">
          Participants (comma separated)
        </label>
        <UIInput
          id="feedback-participants"
          value={participants()}
          onInput={(event) => setParticipants(event.currentTarget.value)}
          placeholder="self, collaborator"
        />

        <label class={fieldLabelClass} for="feedback-context">
          Listening Context
        </label>
        <UITextarea
          id="feedback-context"
          value={contextMd()}
          onInput={(event) => setContextMd(event.currentTarget.value)}
          placeholder="Headphones, low-volume, evening session"
        />

        <label class={fieldLabelClass} for="feedback-notes">
          Feedback Notes
        </label>
        <UITextarea
          id="feedback-notes"
          value={feedbackMd()}
          onInput={(event) => setFeedbackMd(event.currentTarget.value)}
          placeholder="Describe body response, harmonic clarity, and next action"
        />

        <div
          class={css({
            display: "grid",
            gap: "3",
            gridTemplateColumns: {
              base: "1fr",
              md: "repeat(4, minmax(0, 1fr))",
            },
          })}
        >
          <div>
            <label class={fieldLabelClass} for="feedback-pleasantness">
              Pleasantness (0-5)
            </label>
            <UIInput
              id="feedback-pleasantness"
              type="number"
              min="0"
              max="5"
              value={pleasantness()}
              onInput={(event) => setPleasantness(event.currentTarget.value)}
            />
          </div>
          <div>
            <label class={fieldLabelClass} for="feedback-goosebumps">
              Goosebumps (0-5)
            </label>
            <UIInput
              id="feedback-goosebumps"
              type="number"
              min="0"
              max="5"
              value={goosebumps()}
              onInput={(event) => setGoosebumps(event.currentTarget.value)}
            />
          </div>
          <div>
            <label class={fieldLabelClass} for="feedback-musicality">
              Musicality (0-5)
            </label>
            <UIInput
              id="feedback-musicality"
              type="number"
              min="0"
              max="5"
              value={musicality()}
              onInput={(event) => setMusicality(event.currentTarget.value)}
            />
          </div>
          <div>
            <label class={fieldLabelClass} for="feedback-expandability">
              Expandability (0-5)
            </label>
            <UIInput
              id="feedback-expandability"
              type="number"
              min="0"
              max="5"
              value={expandability()}
              onInput={(event) => setExpandability(event.currentTarget.value)}
              placeholder="4"
            />
          </div>
        </div>

        <div
          class={css({
            display: "grid",
            gap: "3",
            gridTemplateColumns: {
              base: "1fr",
              md: "1fr 1fr",
            },
            marginTop: "3",
          })}
        >
          <div>
            <label class={fieldLabelClass} for="feedback-felt">
              Felt Qualities
            </label>
            <UIInput
              id="feedback-felt"
              value={feltQualities()}
              onInput={(event) => setFeltQualities(event.currentTarget.value)}
              placeholder="weightless, suspended, glassy"
            />
          </div>
          <div>
            <label class={fieldLabelClass} for="feedback-body-tags">
              Body Map Tags
            </label>
            <UIInput
              id="feedback-body-tags"
              value={bodyMapTags()}
              onInput={(event) => setBodyMapTags(event.currentTarget.value)}
              placeholder="chest, jaw, spine"
            />
          </div>
        </div>

        <label class={fieldLabelClass} for="feedback-standout">
          Standout Moments
        </label>
        <UITextarea
          id="feedback-standout"
          value={standoutMoments()}
          onInput={(event) => setStandoutMoments(event.currentTarget.value)}
          placeholder={"0:22 low swell hits the chest\n0:46 harmony opens up"}
        />

        <div
          class={css({
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            marginTop: "4",
          })}
        >
          <div aria-live="polite">
            <Show when={notice()}>
              {(message) => (
                <p class={css({ color: "zodiac.cream" })}>{message()}</p>
              )}
            </Show>
          </div>
          <UIButton type="submit" variant="solid">
            Log Session
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Recent Feedback</h2>
        <Show when={!sessions.isLoading()} fallback={<p>Loading sessions…</p>}>
          <Show
            when={!sessions.isError()}
            fallback={
              <p class={css({ color: "zodiac.error" })}>
                Failed to load sessions:{" "}
                {sessions.error()?.message ?? "Unknown error"}
              </p>
            }
          >
            <div class={css({ display: "grid", gap: "3" })}>
              <For each={sessions.data() ?? []}>
                {(session: Doc<"listeningSessions">) => (
                  <div
                    class={css({
                      borderColor: "rgba(200, 168, 75, 0.24)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      p: "4",
                    })}
                  >
                    <div
                      class={css({
                        display: "flex",
                        gap: "2",
                        marginBottom: "2",
                      })}
                    >
                      <UIBadge tone="gold">
                        {compositionById().get(String(session.compositionId)) ??
                          "Composition"}
                      </UIBadge>
                      <UIBadge tone="cream">
                        {session.participants.length} listeners
                      </UIBadge>
                    </div>
                    <p
                      class={css({
                        color: "rgba(245, 240, 232, 0.75)",
                        marginBottom: "2",
                      })}
                    >
                      {session.feedbackMd}
                    </p>
                    <p
                      class={css({
                        color: "rgba(245, 240, 232, 0.55)",
                        fontFamily: "mono",
                        fontSize: "xs",
                        marginBottom:
                          session.ratings?.expandability !== undefined ||
                          (session.feltQualities?.length ?? 0) > 0
                            ? "2"
                            : "0",
                      })}
                    >
                      pleasantness: {session.ratings?.bodilyPleasantness ?? "-"}{" "}
                      · goosebumps: {session.ratings?.goosebumps ?? "-"} ·
                      musicality: {session.ratings?.musicality ?? "-"}
                    </p>
                    <Show when={session.ratings?.expandability !== undefined}>
                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.62)",
                          fontFamily: "mono",
                          fontSize: "xs",
                          marginBottom:
                            (session.feltQualities?.length ?? 0) > 0 ||
                            (session.standoutMoments?.length ?? 0) > 0
                              ? "2"
                              : "0",
                        })}
                      >
                        expandability: {session.ratings?.expandability}
                      </p>
                    </Show>
                    <Show when={(session.feltQualities?.length ?? 0) > 0}>
                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.62)",
                          fontSize: "sm",
                          marginBottom:
                            (session.standoutMoments?.length ?? 0) > 0
                              ? "2"
                              : "0",
                        })}
                      >
                        Felt: {session.feltQualities?.join(", ")}
                      </p>
                    </Show>
                    <Show when={(session.standoutMoments?.length ?? 0) > 0}>
                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.55)",
                          fontSize: "sm",
                        })}
                      >
                        Standout:{" "}
                        {truncate(session.standoutMoments?.slice(0, 2).join(" • ") ?? "", 160)}
                      </p>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
