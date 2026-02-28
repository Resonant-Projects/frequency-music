import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { For, Show, createMemo, createSignal } from "solid-js";
import { css } from "../../styled-system/css";
import { UIBadge, UIButton, UICard, UIInput, UITextarea } from "../components/ui";
import { convexApi } from "../integrations/convex/api";
import {
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { withDevBypassSecret } from "../integrations/authBypass";

const pageClass = css({
  display: "grid",
  gap: "6",
  p: { base: "4", md: "6" },
});

const sectionTitleClass = css({
  color: "zodiac.gold",
  fontSize: "lg",
  letterSpacing: "0.12em",
  marginBottom: "3",
  textTransform: "uppercase",
});

const fieldLabelClass = css({
  color: "rgba(245, 240, 232, 0.75)",
  display: "block",
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.14em",
  marginBottom: "1.5",
  textTransform: "uppercase",
});

function parseParticipants(input: string) {
  return input
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, role: "collaborator" }));
}

export function FeedbackPage() {
  const compositions = createQuery(convexApi.compositions.list, () => ({
    limit: 40,
  }));
  const sessions = createQueryWithStatus(convexApi.listening.listRecent, () => ({
    limit: 30,
  }));
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
  const [notice, setNotice] = createSignal<string | null>(null);

  async function submitSession(event: SubmitEvent) {
    event.preventDefault();

    if (!compositionId() || !feedbackMd().trim()) {
      setNotice("Composition and feedback are required.");
      return;
    }

    try {
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
          },
        }),
      );

      setParticipants("");
      setContextMd("");
      setFeedbackMd("");
      setNotice("Listening session logged.");
    } catch (error) {
      setNotice(`Failed to log session: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard as="form" onSubmit={submitSession}>
        <h1 class={sectionTitleClass}>Feedback & Listening Sessions</h1>

        <label class={fieldLabelClass} for="feedback-composition">
          Composition
        </label>
        <select
          id="feedback-composition"
          value={compositionId()}
          onChange={(event) => setCompositionId(event.currentTarget.value)}
          class={css({
            bg: "rgba(26, 15, 53, 0.45)",
            borderColor: "rgba(200, 168, 75, 0.28)",
            borderRadius: "l2",
            borderWidth: "1px",
            color: "zodiac.cream",
            minH: "10",
            px: "3",
            width: "full",
          })}
        >
          <option value="">Select composition</option>
          <For each={compositions() ?? []}>
            {(item: Doc<"compositions">) => (
              <option value={String(item._id)}>{item.title}</option>
            )}
          </For>
        </select>

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

        <div class={css({ display: "grid", gap: "3", gridTemplateColumns: { base: "1fr", md: "repeat(3, minmax(0, 1fr))" } })}>
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
        </div>

        <div class={css({ alignItems: "center", display: "flex", justifyContent: "space-between", marginTop: "4" })}>
          <Show when={notice()}>
            {(message) => <p class={css({ color: "zodiac.cream" })}>{message()}</p>}
          </Show>
          <UIButton type="submit" variant="solid">
            Log Session
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Recent Feedback</h2>
        <Show when={!sessions.isLoading()} fallback={<p>Loading sessions…</p>}>
          <div class={css({ display: "grid", gap: "3" })}>
            <For each={sessions.data() ?? []}>
              {(session: Doc<"listeningSessions">) => (
                <div class={css({ borderColor: "rgba(200, 168, 75, 0.24)", borderRadius: "l2", borderWidth: "1px", p: "4" })}>
                  <div class={css({ display: "flex", gap: "2", marginBottom: "2" })}>
                    <UIBadge tone="gold">
                      {compositionById().get(String(session.compositionId)) ?? "Composition"}
                    </UIBadge>
                    <UIBadge tone="cream">{session.participants.length} listeners</UIBadge>
                  </div>
                  <p class={css({ color: "rgba(245, 240, 232, 0.75)", marginBottom: "2" })}>
                    {session.feedbackMd}
                  </p>
                  <p class={css({ color: "rgba(245, 240, 232, 0.55)", fontFamily: "mono", fontSize: "xs" })}>
                    pleasantness: {session.ratings?.bodilyPleasantness ?? "-"} · goosebumps: {session.ratings?.goosebumps ?? "-"} · musicality: {session.ratings?.musicality ?? "-"}
                  </p>
                </div>
              )}
            </For>
          </div>
        </Show>
      </UICard>
    </section>
  );
}
