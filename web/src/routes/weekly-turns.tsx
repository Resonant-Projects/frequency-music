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
import {
  createAction,
  createMutation,
  createQuery,
  createQueryWithStatus,
} from "../integrations/convex";
import { api } from "../../../convex/_generated/api";
import { extractTitle } from "../lib/markdown-utils";

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

type CampaignDraft = {
  title: string;
  question: string;
  descriptionMd: string;
  status: "active" | "paused" | "completed";
};

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
  onActivate: (id: Id<"campaigns">) => Promise<void>;
  onCreateRecap: (id: Id<"campaigns">) => Promise<void>;
  onSave: (args: {
    id: Id<"campaigns">;
    title: string;
    question: string;
    descriptionMd?: string;
    status: "active" | "paused" | "completed";
  }) => Promise<void>;
  onNotice?: (message: string) => void;
}) {
  const [draft, setDraft] = createSignal<CampaignDraft>(
    buildDraft(props.campaign),
  );
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [activating, setActivating] = createSignal(false);
  const [creatingRecap, setCreatingRecap] = createSignal(false);

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
      props.onNotice?.("Campaign title and question are required.");
      return false;
    }
    setSaving(true);
    try {
      await props.onSave({
        id: props.campaign._id,
        title,
        question,
        descriptionMd: currentDraft.descriptionMd.trim() || undefined,
        status: currentDraft.status,
      });
      setDirty(false);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      await props.onActivate(props.campaign._id);
      setDirty(false);
    } finally {
      setActivating(false);
    }
  }

  async function handleCreateRecap() {
    setCreatingRecap(true);
    try {
      if (dirty() && !(await saveCampaign())) return;
      await props.onCreateRecap(props.campaign._id);
    } finally {
      setCreatingRecap(false);
    }
  }

  return (
    <div
      data-testid="campaign-card"
      class={css({
        borderColor: "rgba(200, 168, 75, 0.22)",
        borderRadius: "l2",
        borderWidth: "1px",
        p: "4",
      })}
    >
      <div
        class={css({
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          gap: "2",
          mb: "3",
          flexWrap: "wrap",
        })}
      >
        <div class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
          <UIBadge tone={props.campaign.status === "active" ? "gold" : "cream"}>
            {props.campaign.status}
          </UIBadge>
          <UIBadge tone="violet">
            {props.campaign.thesisIds.length} theses
          </UIBadge>
        </div>
        <Show when={props.campaign.status !== "active"}>
          <UIButton
            variant="outline"
            onClick={handleActivate}
            disabled={saving() || activating() || creatingRecap()}
          >
            {activating() ? "Activating..." : "Set Active"}
          </UIButton>
        </Show>
        <UIButton
          variant="outline"
          onClick={handleCreateRecap}
          disabled={saving() || activating() || creatingRecap()}
        >
          {creatingRecap() ? "Creating summary..." : "Create summary"}
        </UIButton>
      </div>

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
          updateDraft(
            "status",
            event.currentTarget.value as "active" | "paused" | "completed",
          )
        }
      >
        <option value="active">active</option>
        <option value="paused">paused</option>
        <option value="completed">completed</option>
      </UISelect>

      <Show when={props.campaign.thesisIds.length > 0}>
        <div class={css({ marginTop: "3" })}>
          <p class={fieldLabelClass}>Attached Theses</p>
          <div class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
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

      <div
        class={css({ display: "flex", justifyContent: "flex-end", mt: "4" })}
      >
        <UIButton
          variant="solid"
          onClick={saveCampaign}
          disabled={saving() || activating()}
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
    limit: 12,
  }));
  const campaigns = createQueryWithStatus(api.campaigns.list, () => ({
    limit: 20,
  }));
  const theses = createQuery(api.theses.list, () => ({
    limit: 100,
  }));
  const steering = createQuery(api.campaigns.getRecommendedActions);

  const briefRows = createMemo<Doc<"weeklyBriefs">[]>(
    () => (briefs.data() ?? []) as Doc<"weeklyBriefs">[],
  );
  const campaignRows = createMemo<Doc<"campaigns">[]>(
    () => (campaigns.data() ?? []) as Doc<"campaigns">[],
  );
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
  const [status, setStatus] = createSignal<"active" | "paused" | "completed">(
    "paused",
  );
  const [notice, setNotice] = createSignal<string | null>(null);

  async function runGenerate() {
    setNotice(null);
    try {
      const result = await generateBrief({ daysBack: 7 });
      setNotice(`Weekly turn generated for ${result.weekOf}.`);
    } catch (error) {
      setNotice(`Generation failed: ${String(error)}`);
    }
  }

  async function handleCreateCampaign(event: SubmitEvent) {
    event.preventDefault();
    if (!title().trim() || !question().trim()) {
      setNotice("Campaign title and question are required.");
      return;
    }

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
      setNotice(`Campaign create failed: ${String(error)}`);
    }
  }

  async function handleActivateCampaign(id: Id<"campaigns">) {
    try {
      await setActiveCampaign({ id });
      setNotice("Active campaign updated.");
    } catch (error) {
      setNotice(`Campaign activation failed: ${String(error)}`);
    }
  }

  async function handleSaveCampaign(args: {
    id: Id<"campaigns">;
    title: string;
    question: string;
    descriptionMd?: string;
    status: "active" | "paused" | "completed";
  }) {
    try {
      await updateCampaign(args);
      setNotice("Campaign updated.");
    } catch (error) {
      setNotice(`Campaign update failed: ${String(error)}`);
    }
  }

  async function handleCreateCampaignRecap(id: Id<"campaigns">) {
    try {
      const artifactId = await createCampaignDraft({ campaignId: id });
      navigate({
        to: "/editorial/$artifactId",
        params: { artifactId: String(artifactId) },
      });
    } catch (error) {
      setNotice(`Campaign summary draft failed: ${String(error)}`);
    }
  }

  return (
    <section class={pageClass}>
      <UICard
        as="form"
        onSubmit={(e: SubmitEvent) => {
          handleCreateCampaign(e);
        }}
      >
        <div
          class={css({
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            gap: "3",
            flexWrap: "wrap",
          })}
        >
          <div>
            <h1 class={pageTitleClass}>Weekly Turns</h1>
            <p
              class={css({
                color: "rgba(245, 240, 232, 0.62)",
                lineHeight: "1.6",
              })}
            >
              Weekly briefs now steer against an active campaign, persisted
              studio prompts, and recommendation signals drawn from listening
              outcomes.
            </p>
          </div>
          <UIButton variant="solid" type="button" onClick={runGenerate}>
            Generate Now
          </UIButton>
        </div>

        <hr
          class={css({
            borderColor: "rgba(200, 168, 75, 0.18)",
            marginY: "4",
          })}
        />

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
            setStatus(
              event.currentTarget.value as "active" | "paused" | "completed",
            )
          }
        >
          <option value="paused">paused</option>
          <option value="active">active</option>
          <option value="completed">completed</option>
        </UISelect>

        <div
          class={css({
            display: "flex",
            justifyContent: "space-between",
            marginTop: "4",
            gap: "3",
            flexWrap: "wrap",
          })}
        >
          <div aria-live="polite">
            <Show when={notice()}>
              {(message) => (
                <p class={css({ color: "zodiac.cream" })}>{message()}</p>
              )}
            </Show>
          </div>
          <UIButton type="submit" variant="outline">
            Create Campaign
          </UIButton>
        </div>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Current Steering</h2>
        <Show when={steering()}>
          {(preview) => (
            <div class={css({ display: "grid", gap: "3" })}>
              <div class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
                <UIBadge tone={preview().campaign ? "gold" : "cream"}>
                  {preview().campaign
                    ? `Active Campaign: ${preview().campaign?.title}`
                    : "No active campaign"}
                </UIBadge>
                <For each={preview().theses}>
                  {(thesis) => <UIBadge tone="violet">{thesis.title}</UIBadge>}
                </For>
              </div>

              <Show
                when={preview().actions.length > 0}
                fallback={
                  <p class={css({ color: "rgba(245, 240, 232, 0.58)" })}>
                    No recommendation candidates yet. Create or attach a thesis
                    to a campaign, then generate more hypotheses and recipes.
                  </p>
                }
              >
                <For each={preview().actions}>
                  {(action) => {
                    const linkClass = css({
                      borderColor: "rgba(200, 168, 75, 0.2)",
                      borderRadius: "l2",
                      borderWidth: "1px",
                      color: "inherit",
                      display: "block",
                      p: "3",
                      textDecoration: "none",
                    });
                    const cardBody = (
                      <>
                        <div
                          class={css({
                            display: "flex",
                            gap: "2",
                            flexWrap: "wrap",
                            mb: "1",
                          })}
                        >
                          <UIBadge tone="gold">{action.durationBucket}</UIBadge>
                          <UIBadge tone="cream">{action.kind}</UIBadge>
                        </div>
                        <div class={css({ color: "zodiac.cream", mb: "1" })}>
                          {action.targetType} {action.targetId.slice(-6)}
                        </div>
                        <p class={css({ color: "rgba(245, 240, 232, 0.62)" })}>
                          {action.reason}
                        </p>
                      </>
                    );
                    return action.targetType === "hypothesis" ? (
                      <Link
                        to="/hypotheses/$hypothesisId"
                        params={{ hypothesisId: action.targetId }}
                        class={linkClass}
                      >
                        {cardBody}
                      </Link>
                    ) : action.targetType === "recipe" ? (
                      <Link
                        to="/recipes/$recipeId"
                        params={{ recipeId: action.targetId }}
                        class={linkClass}
                      >
                        {cardBody}
                      </Link>
                    ) : (
                      <Link
                        to="/compositions/$compositionId"
                        params={{ compositionId: action.targetId }}
                        class={linkClass}
                      >
                        {cardBody}
                      </Link>
                    );
                  }}
                </For>
              </Show>
            </div>
          )}
        </Show>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Campaigns</h2>
        <Show
          when={!campaigns.isLoading()}
          fallback={<p>Loading campaigns...</p>}
        >
          <Show
            when={!campaigns.isError()}
            fallback={
              <p
                class={css({
                  color: "rgba(220, 100, 100, 0.85)",
                  lineHeight: "1.6",
                })}
              >
                Failed to load campaigns. {campaigns.error()?.message}
              </p>
            }
          >
            <Show
              when={campaignRows().length > 0}
              fallback={
                <p
                  class={css({
                    color: "rgba(245, 240, 232, 0.55)",
                    lineHeight: "1.6",
                  })}
                >
                  No campaigns yet. Create one above to start organizing weekly
                  work into longer arcs.
                </p>
              }
            >
              <div class={css({ display: "grid", gap: "3" })}>
                <For each={campaignRows()}>
                  {(campaign) => (
                    <CampaignCard
                      campaign={campaign}
                      thesisTitleById={thesisTitleById()}
                      onActivate={handleActivateCampaign}
                      onCreateRecap={handleCreateCampaignRecap}
                      onSave={handleSaveCampaign}
                      onNotice={setNotice}
                    />
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>
      </UICard>

      <UICard>
        <h2 class={sectionTitleClass}>Generated Briefs</h2>

        <Show
          when={!briefs.isLoading()}
          fallback={<p>Loading weekly turns...</p>}
        >
          <Show
            when={!briefs.isError()}
            fallback={
              <p
                class={css({
                  color: "rgba(220, 100, 100, 0.85)",
                  lineHeight: "1.6",
                })}
              >
                Failed to load briefs. {briefs.error()?.message}
              </p>
            }
          >
            <Show
              when={briefRows().length > 0}
              fallback={
                <p
                  class={css({
                    color: "rgba(245, 240, 232, 0.55)",
                    fontFamily: "display",
                    fontSize: "md",
                    lineHeight: "1.6",
                    textAlign: "center",
                    py: "8",
                  })}
                >
                  No weekly turns yet. Generate one to summarize the latest
                  ingest cycle.
                </p>
              }
            >
              <div class={css({ display: "grid", gap: "3" })}>
                <For each={briefRows()}>
                  {(brief) => (
                    <Link
                      to="/weekly-turns/$briefId"
                      params={{ briefId: String(brief._id) }}
                      class={css({
                        borderColor: "rgba(200, 168, 75, 0.25)",
                        borderRadius: "l2",
                        borderWidth: "1px",
                        cursor: "pointer",
                        display: "block",
                        p: "4",
                        textDecoration: "none",
                        transition: "border-color 0.15s",
                        _hover: {
                          borderColor: "rgba(200, 168, 75, 0.5)",
                        },
                      })}
                    >
                      <div
                        class={css({
                          alignItems: "center",
                          display: "flex",
                          gap: "2",
                          justifyContent: "space-between",
                          marginBottom: "2",
                        })}
                      >
                        <div
                          class={css({
                            display: "flex",
                            gap: "2",
                            flexWrap: "wrap",
                          })}
                        >
                          <UIBadge tone="gold">Week {brief.weekOf}</UIBadge>
                          <UIBadge tone="cream">{brief.visibility}</UIBadge>
                          <Show when={brief.campaignId}>
                            <UIBadge tone="violet">campaign</UIBadge>
                          </Show>
                          <Show when={(brief.activeThesisIds ?? []).length > 0}>
                            <UIBadge tone="violet">
                              {(brief.activeThesisIds ?? []).length} theses
                            </UIBadge>
                          </Show>
                          <Show
                            when={(brief.recommendedActions ?? []).length > 0}
                          >
                            <UIBadge tone="violet">
                              {(brief.recommendedActions ?? []).length} actions
                            </UIBadge>
                          </Show>
                          <Show when={brief.publishedAt}>
                            {(ts) => (
                              <UIBadge tone="violet">
                                Published{" "}
                                {new Date(ts()).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </UIBadge>
                            )}
                          </Show>
                        </div>
                      </div>

                      <h3
                        class={css({
                          color: "zodiac.cream",
                          fontFamily: "display",
                          fontSize: "lg",
                          fontWeight: "normal",
                          lineHeight: "1.4",
                          mb: "2",
                        })}
                      >
                        {extractTitle(brief.bodyMd)}
                      </h3>

                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.55)",
                          fontFamily: "body",
                          fontSize: "sm",
                          lineHeight: "1.6",
                          mb: "2",
                        })}
                      >
                        {extractExcerpt(brief.bodyMd)}
                      </p>

                      <p
                        class={css({
                          color: "rgba(245, 240, 232, 0.55)",
                          fontFamily: "mono",
                          fontSize: "xs",
                        })}
                      >
                        model: {brief.model} · prompt: {brief.promptVersion}
                      </p>
                    </Link>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>
      </UICard>
    </section>
  );
}
