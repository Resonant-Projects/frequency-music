import { Link, useNavigate } from "@tanstack/solid-router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import {
  entityCardClass,
  entityCardLinkClass,
  entityCardTitleLinkClass,
} from "../components/entity-card";
import { RecommendedActionCard } from "../components/recommended-action-card";
import {
  badgeRowClass,
  DateTime,
  fieldLabelClass,
  goldDivider,
  helperClass,
  metaLine,
  pageClass,
  pageTitleClass,
  sectionTitleClass,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UIList,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import {
  createAction,
  createMutation,
  createQuery,
  createQueryWithStatus,
  describeError,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";
import { extractTitle } from "../lib/markdown-utils";

const BRIEF_LIMIT = 12;
const CAMPAIGN_LIMIT = 20;

function extractExcerpt(bodyMd: string, maxLen = 180): string {
  const lines = bodyMd.split("\n");
  const contentLines: string[] = [];
  let pastFirstHeading = false;

  for (const line of lines) {
    if (!pastFirstHeading) {
      if (line.match(/^#\s+/)) {
        pastFirstHeading = true;
      }
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    const plain = trimmed
      .replace(/^#{1,6}\s+/, "")
      .replaceAll(/\*\*(.*?)\*\*/g, "$1")
      .replaceAll(/\*(.*?)\*/g, "$1")
      .replaceAll(/`(.*?)`/g, "$1")
      .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    contentLines.push(plain);
    if (contentLines.join(" ").length >= maxLen) break;
  }

  const text = contentLines.join(" ");
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

/** True once focus has fallen to <body>, e.g. because its element moved. */
function focusWasLost() {
  return (
    document.activeElement === null || document.activeElement === document.body
  );
}

type CampaignStatus = "active" | "paused" | "completed";

type CampaignDraft = {
  title: string;
  question: string;
  descriptionMd: string;
  status: CampaignStatus;
};

type CampaignSaveArgs = {
  id: Id<"campaigns">;
  title: string;
  question: string;
  descriptionMd?: string;
  status: CampaignStatus;
};

const cardHeaderClass = css({
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  gap: "2",
  mb: "3",
  flexWrap: "wrap",
});

const campaignTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: "xl",
  fontWeight: "normal",
  lineHeight: "1.35",
  mb: "2",
});

const attachedThesesClass = css({ marginTop: "3" });

const cardFooterClass = css({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "3",
  justifyContent: "space-between",
  mt: "4",
});

const pushEndClass = css({ ml: "auto" });

const pageHeaderClass = css({
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  gap: "3",
  flexWrap: "wrap",
});

const noticeSpacingClass = css({ mt: "3" });

const formEndClass = css({
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "4",
});

const stackClass = css({ display: "grid", gap: "3" });

const limitNoteClass = cx(helperClass, css({ mb: "3" }));

const emptyBriefsClass = css({
  color: "zodiac.cream/66",
  fontFamily: "display",
  fontSize: "md",
  lineHeight: "1.6",
  textAlign: "center",
  py: "8",
});

const briefBadgesClass = cx(badgeRowClass, css({ mb: "2" }));

const publishedBadgeClass = css({ gap: "1" });

const briefTitleClass = css({
  color: "zodiac.cream",
  fontFamily: "display",
  fontSize: "lg",
  fontWeight: "normal",
  lineHeight: "1.4",
  mb: "2",
});

const campaignMarkClass = css({ ml: "2", verticalAlign: "middle" });

const briefExcerptClass = cx(helperClass, css({ mb: "2" }));

function buildDraft(campaign: Doc<"campaigns">): CampaignDraft {
  return {
    title: campaign.title,
    question: campaign.question,
    descriptionMd: campaign.descriptionMd ?? "",
    status: campaign.status,
  };
}

function CampaignCard(props: {
  campaign: Doc<"campaigns">;
  thesisTitleById: Map<string, string>;
  onActivate: (id: Id<"campaigns">) => Promise<unknown>;
  onCreateRecap: (id: Id<"campaigns">) => Promise<void>;
  onSave: (args: CampaignSaveArgs) => Promise<unknown>;
}) {
  const [draft, setDraft] = createSignal<CampaignDraft>(
    buildDraft(props.campaign),
  );
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [activating, setActivating] = createSignal(false);
  const [creatingRecap, setCreatingRecap] = createSignal(false);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const busy = () => saving() || activating() || creatingRecap();
  // The heading outlives "Set Active", which unmounts once the campaign is
  // active, so it is where focus goes after a successful activation.
  let heading: HTMLHeadingElement | undefined;
  let saveButton: HTMLButtonElement | undefined;

  function resetDraftFromCampaign(campaign: Doc<"campaigns">) {
    setDraft(buildDraft(campaign));
    setDirty(false);
  }

  function updateDraft<K extends keyof CampaignDraft>(
    key: K,
    value: CampaignDraft[K],
  ) {
    setDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function clearNotice() {
    setNotice(null);
    setNoticeError(null);
  }

  let lastCampaignId = String(props.campaign._id);
  let lastUpdatedAt = props.campaign.updatedAt;

  createEffect(() => {
    const campaignId = String(props.campaign._id);
    const updatedAt = props.campaign.updatedAt;
    const changedCampaign = campaignId !== lastCampaignId;
    const changedVersion = updatedAt !== lastUpdatedAt;

    if (changedCampaign || (changedVersion && !dirty())) {
      resetDraftFromCampaign(props.campaign);
    }

    lastCampaignId = campaignId;
    lastUpdatedAt = updatedAt;
  });

  async function saveCampaign() {
    const currentDraft = draft();
    const title = currentDraft.title.trim();
    const question = currentDraft.question.trim();
    if (!title || !question) {
      setNotice(null);
      setNoticeError("Campaign title and question are required.");
      return false;
    }
    setSaving(true);
    clearNotice();
    try {
      await props.onSave({
        id: props.campaign._id,
        title,
        question,
        descriptionMd: currentDraft.descriptionMd.trim() || undefined,
        status: currentDraft.status,
      });
      setDirty(false);
      setNotice("Campaign updated.");
      // A save bumps `updatedAt`, which reorders the list and can drop focus
      // from the moved card's button.
      if (focusWasLost()) saveButton?.focus();
      return true;
    } catch (error) {
      // Keep `dirty` so the edit survives and `handleCreateRecap` stops here.
      setNoticeError(`Campaign update failed: ${describeError(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (busy()) return;
    await saveCampaign();
  }

  async function handleActivate() {
    if (busy()) return;
    setActivating(true);
    clearNotice();
    try {
      await props.onActivate(props.campaign._id);
      setDirty(false);
      setNotice("Active campaign updated.");
      heading?.focus();
    } catch (error) {
      // Leave any unsaved edit marked as such.
      setNoticeError(`Campaign activation failed: ${describeError(error)}`);
    } finally {
      setActivating(false);
    }
  }

  async function handleCreateRecap() {
    if (busy()) return;
    setCreatingRecap(true);
    clearNotice();
    try {
      if (dirty() && !(await saveCampaign())) return;
      await props.onCreateRecap(props.campaign._id);
    } catch (error) {
      setNoticeError(`Campaign summary draft failed: ${describeError(error)}`);
    } finally {
      setCreatingRecap(false);
    }
  }

  return (
    <div data-testid="campaign-card" class={entityCardClass}>
      <div class={cardHeaderClass}>
        <div class={badgeRowClass}>
          <UIBadge tone={props.campaign.status === "active" ? "gold" : "cream"}>
            {props.campaign.status}
          </UIBadge>
          <UIBadge tone="cream">
            {props.campaign.thesisIds.length} theses
          </UIBadge>
        </div>
        <Show when={props.campaign.status !== "active"}>
          <UIButton
            variant="outline"
            onClick={() => void handleActivate()}
            aria-busy={activating()}
            aria-disabled={busy() || undefined}
          >
            {activating() ? "Activating..." : "Set Active"}
          </UIButton>
        </Show>
        <UIButton
          variant="outline"
          onClick={() => void handleCreateRecap()}
          aria-busy={creatingRecap()}
          aria-disabled={busy() || undefined}
        >
          {creatingRecap() ? "Creating summary..." : "Create summary"}
        </UIButton>
      </div>

      <h3
        ref={(element) => {
          heading = element;
        }}
        tabindex="-1"
        class={campaignTitleClass}
      >
        {draft().title || "Untitled campaign"}
      </h3>

      <label
        for={`campaign-${props.campaign._id}-title`}
        class={fieldLabelClass}
      >
        Title
      </label>
      <UIInput
        id={`campaign-${props.campaign._id}-title`}
        value={draft().title}
        onInput={(event) => updateDraft("title", event.currentTarget.value)}
      />

      <label
        for={`campaign-${props.campaign._id}-question`}
        class={fieldLabelClass}
      >
        Question
      </label>
      <UITextarea
        id={`campaign-${props.campaign._id}-question`}
        value={draft().question}
        onInput={(event) => updateDraft("question", event.currentTarget.value)}
      />

      <label
        for={`campaign-${props.campaign._id}-description`}
        class={fieldLabelClass}
      >
        Description
      </label>
      <UITextarea
        id={`campaign-${props.campaign._id}-description`}
        value={draft().descriptionMd}
        onInput={(event) =>
          updateDraft("descriptionMd", event.currentTarget.value)
        }
      />

      <label
        for={`campaign-${props.campaign._id}-status`}
        class={fieldLabelClass}
      >
        Status
      </label>
      <UISelect
        id={`campaign-${props.campaign._id}-status`}
        value={draft().status}
        onChange={(event) =>
          updateDraft("status", event.currentTarget.value as CampaignStatus)
        }
      >
        <option value="active">active</option>
        <option value="paused">paused</option>
        <option value="completed">completed</option>
      </UISelect>

      <Show when={props.campaign.thesisIds.length > 0}>
        <div class={attachedThesesClass}>
          <p class={fieldLabelClass}>Attached Theses</p>
          <div class={badgeRowClass}>
            <For each={props.campaign.thesisIds}>
              {(thesisId) => (
                <UIBadge tone="cream">
                  {props.thesisTitleById.get(String(thesisId)) ??
                    String(thesisId).slice(-6)}
                </UIBadge>
              )}
            </For>
          </div>
        </div>
      </Show>

      <div class={cardFooterClass}>
        <UINotice status={notice()} error={noticeError()} />
        <UIButton
          ref={(element) => {
            saveButton = element;
          }}
          type="button"
          variant="outline"
          class={pushEndClass}
          onClick={() => void handleSave()}
          aria-busy={saving()}
          aria-disabled={busy() || undefined}
        >
          {saving() ? "Saving..." : "Save Campaign"}
        </UIButton>
      </div>
    </div>
  );
}

export function WeeklyTurnsPage() {
  const navigate = useNavigate();
  onMount(() => {
    document.title = "Weekly Turns — Frequency Music";
  });

  const briefs = createQueryWithStatus(api.weeklyBriefs.list, () => ({
    limit: BRIEF_LIMIT,
  }));
  const campaigns = createQueryWithStatus(api.campaigns.list, () => ({
    limit: CAMPAIGN_LIMIT,
  }));
  const theses = createQuery(api.theses.list, () => ({
    limit: 100,
  }));
  const steering = createQueryWithStatus(api.campaigns.getRecommendedActions);

  const briefRows = createMemo<Doc<"weeklyBriefs">[]>(
    () => (briefs.data() ?? []) as Doc<"weeklyBriefs">[],
  );
  const campaignRows = createMemo<Doc<"campaigns">[]>(
    () => (campaigns.data() ?? []) as Doc<"campaigns">[],
  );
  // Each live update delivers fresh row objects. Keying the cards by id keeps a
  // card (its draft, notice and focused control) mounted across those updates.
  const campaignIds = createMemo(() =>
    campaignRows().map((campaign) => String(campaign._id)),
  );
  const campaignById = createMemo(() => {
    const map = new Map<string, Doc<"campaigns">>();
    for (const campaign of campaignRows()) {
      map.set(String(campaign._id), campaign);
    }
    return map;
  });
  const thesisTitleById = createMemo(() => {
    const map = new Map<string, string>();
    for (const thesis of (theses() ?? []) as Doc<"theses">[]) {
      map.set(String(thesis._id), thesis.title);
    }
    return map;
  });

  const generateBrief = createAction(api.weeklyBriefs.generate);
  const createCampaign = createMutation(api.campaigns.create);
  const updateCampaign = createMutation(api.campaigns.update);
  const setActiveCampaign = createMutation(api.campaigns.setActive);
  const createCampaignDraft = createMutation(
    api.editorialArtifacts.createDraftFromCampaign,
  );

  const [title, setTitle] = createSignal("");
  const [question, setQuestion] = createSignal("");
  const [descriptionMd, setDescriptionMd] = createSignal("");
  const [status, setStatus] = createSignal<CampaignStatus>("paused");
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  const [generating, setGenerating] = createSignal(false);

  async function runGenerate() {
    if (generating()) return;
    setGenerating(true);
    setNotice(null);
    setNoticeError(null);
    try {
      const result = await generateBrief({ daysBack: 7 });
      setNotice(`Weekly turn generated for ${result.weekOf}.`);
    } catch (error) {
      setNoticeError(`Generation failed: ${describeError(error)}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateCampaign(event: SubmitEvent) {
    event.preventDefault();
    if (!title().trim() || !question().trim()) {
      setNotice(null);
      setNoticeError("Campaign title and question are required.");
      return;
    }

    setNotice(null);
    setNoticeError(null);
    try {
      await createCampaign({
        title: title().trim(),
        question: question().trim(),
        descriptionMd: descriptionMd().trim() || undefined,
        status: status(),
      });
      setTitle("");
      setQuestion("");
      setDescriptionMd("");
      setStatus("paused");
      setNotice("Campaign created.");
    } catch (error) {
      setNoticeError(`Campaign create failed: ${describeError(error)}`);
    }
  }

  // The card reports the outcome of its activate, save and recap calls in its
  // own notice, so they only run the call and let a failure reach it.
  async function handleCreateCampaignRecap(id: Id<"campaigns">) {
    const artifactId = await createCampaignDraft({ campaignId: id });
    void navigate({
      to: "/editorial/$artifactId",
      params: { artifactId: String(artifactId) },
    });
  }

  return (
    <section class={pageClass}>
      <UICard
        as="form"
        onSubmit={(e: SubmitEvent) => {
          void handleCreateCampaign(e);
        }}
      >
        <div class={pageHeaderClass}>
          <div>
            <h1 class={pageTitleClass}>Weekly Turns</h1>
            <p class={helperClass}>
              Weekly briefs now steer against an active campaign, persisted
              studio prompts, and recommendation signals drawn from listening
              outcomes.
            </p>
          </div>
          <UIButton
            variant="solid"
            type="button"
            aria-busy={generating()}
            aria-disabled={generating() || undefined}
            onClick={() => void runGenerate()}
          >
            {generating() ? "Generating..." : "Generate Now"}
          </UIButton>
        </div>

        <UINotice
          class={noticeSpacingClass}
          status={notice()}
          error={noticeError()}
        />

        <hr class={goldDivider} />

        <h2 class={sectionTitleClass}>Create Campaign</h2>
        <label class={fieldLabelClass} for="campaign-title">
          Title
        </label>
        <UIInput
          id="campaign-title"
          value={title()}
          onInput={(event) => setTitle(event.currentTarget.value)}
          placeholder="Harmonic drift as form"
        />

        <label class={fieldLabelClass} for="campaign-question">
          Guiding Question
        </label>
        <UITextarea
          id="campaign-question"
          value={question()}
          onInput={(event) => setQuestion(event.currentTarget.value)}
          placeholder="What larger musical chapter should this weekly work accumulate toward?"
        />

        <label class={fieldLabelClass} for="campaign-description">
          Description
        </label>
        <UITextarea
          id="campaign-description"
          value={descriptionMd()}
          onInput={(event) => setDescriptionMd(event.currentTarget.value)}
          placeholder="Optional context for this chapter."
        />

        <label class={fieldLabelClass} for="campaign-status">
          Initial Status
        </label>
        <UISelect
          id="campaign-status"
          value={status()}
          onChange={(event) =>
            setStatus(event.currentTarget.value as CampaignStatus)
          }
        >
          <option value="paused">paused</option>
          <option value="active">active</option>
          <option value="completed">completed</option>
        </UISelect>

        <div class={formEndClass}>
          <UIButton type="submit" variant="outline">
            Create Campaign
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Current Steering</h2>
        <UINotice
          status={steering.isLoading() ? "Loading current steering..." : null}
          error={
            steering.isError()
              ? `Failed to load current steering. ${steering.error()?.message}`
              : null
          }
        />
        <Show when={steering.data()}>
          {(preview) => (
            <div class={stackClass}>
              <div class={badgeRowClass}>
                <UIBadge tone={preview().campaign ? "gold" : "cream"}>
                  {preview().campaign
                    ? `Active Campaign: ${preview().campaign?.title}`
                    : "No active campaign"}
                </UIBadge>
                <For each={preview().theses}>
                  {(thesis) => <UIBadge tone="cream">{thesis.title}</UIBadge>}
                </For>
              </div>

              <Show
                when={preview().actions.length > 0}
                fallback={
                  <p class={helperClass}>
                    No recommendation candidates yet. Create or attach a thesis
                    to a campaign, then generate more hypotheses and recipes.
                  </p>
                }
              >
                <UIList class={stackClass}>
                  <For each={preview().actions}>
                    {(action) => (
                      <li>
                        <RecommendedActionCard action={action} />
                      </li>
                    )}
                  </For>
                </UIList>
              </Show>
            </div>
          )}
        </Show>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Campaigns</h2>
        <UINotice
          status={
            campaigns.isLoading()
              ? "Loading campaigns..."
              : !campaigns.isError() && campaignRows().length === 0
                ? "No campaigns yet. Create one above to start organizing weekly work into longer arcs."
                : null
          }
          error={
            campaigns.isError()
              ? `Failed to load campaigns. ${campaigns.error()?.message}`
              : null
          }
        />
        <Show when={!campaigns.isLoading()}>
          <Show when={!campaigns.isError()}>
            <Show when={campaignRows().length > 0}>
              <Show when={campaignRows().length >= CAMPAIGN_LIMIT}>
                <p class={limitNoteClass}>
                  Showing the {CAMPAIGN_LIMIT} most recently updated campaigns.
                </p>
              </Show>
              <UIList class={stackClass}>
                <For each={campaignIds()}>
                  {(campaignId) => (
                    <Show when={campaignById().get(campaignId)}>
                      {(campaign) => (
                        <li>
                          <CampaignCard
                            campaign={campaign()}
                            thesisTitleById={thesisTitleById()}
                            onActivate={(id) => setActiveCampaign({ id })}
                            onCreateRecap={handleCreateCampaignRecap}
                            onSave={updateCampaign}
                          />
                        </li>
                      )}
                    </Show>
                  )}
                </For>
              </UIList>
            </Show>
          </Show>
        </Show>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Generated Briefs</h2>

        <UINotice
          status={briefs.isLoading() ? "Loading weekly turns..." : null}
          error={
            briefs.isError()
              ? `Failed to load briefs. ${briefs.error()?.message}`
              : null
          }
        />
        <Show when={!briefs.isLoading()}>
          <Show when={!briefs.isError()}>
            <Show
              when={briefRows().length > 0}
              fallback={
                <p class={emptyBriefsClass}>
                  No weekly turns yet. Generate one to summarize the latest
                  ingest cycle.
                </p>
              }
            >
              <Show when={briefRows().length >= BRIEF_LIMIT}>
                <p class={limitNoteClass}>
                  Showing the {BRIEF_LIMIT} most recent weekly turns.
                </p>
              </Show>
              <UIList class={stackClass}>
                <For each={briefRows()}>
                  {(brief) => (
                    <li class={entityCardLinkClass}>
                      <div class={briefBadgesClass}>
                        <UIBadge tone="gold">Week {brief.weekOf}</UIBadge>
                        <UIBadge tone="cream">{brief.visibility}</UIBadge>
                        <Show when={(brief.activeThesisIds ?? []).length > 0}>
                          <UIBadge tone="cream">
                            {(brief.activeThesisIds ?? []).length} theses
                          </UIBadge>
                        </Show>
                        <Show
                          when={(brief.recommendedActions ?? []).length > 0}
                        >
                          <UIBadge tone="cream">
                            {(brief.recommendedActions ?? []).length} actions
                          </UIBadge>
                        </Show>
                        <Show when={brief.publishedAt}>
                          {(ts) => (
                            <UIBadge tone="gold" class={publishedBadgeClass}>
                              Published
                              <DateTime value={ts()} />
                            </UIBadge>
                          )}
                        </Show>
                      </div>

                      <h3 class={briefTitleClass}>
                        <Link
                          to="/weekly-turns/$briefId"
                          params={{ briefId: String(brief._id) }}
                          class={entityCardTitleLinkClass}
                        >
                          {extractTitle(brief.bodyMd)}
                          {/* Inside the link so the link names its campaign. */}
                          <Show when={brief.campaignId}>
                            <UIBadge tone="cream" class={campaignMarkClass}>
                              campaign
                            </UIBadge>
                          </Show>
                        </Link>
                      </h3>

                      <p class={briefExcerptClass}>
                        {extractExcerpt(brief.bodyMd)}
                      </p>

                      <p class={metaLine}>
                        model: {brief.model} · prompt: {brief.promptVersion}
                      </p>
                    </li>
                  )}
                </For>
              </UIList>
            </Show>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
