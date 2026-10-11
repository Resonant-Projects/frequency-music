import { Link, useParams } from "@tanstack/solid-router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  Show,
} from "solid-js";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { css, cx } from "../../styled-system/css";
import { entityCellClass } from "../components/entity-card";
import {
  backLink,
  badgeRowClass,
  collapsedNoticeClass,
  detailTitleClass,
  fieldLabelClass,
  goldDivider,
  jsonBlockClass,
  pageClass,
  sectionLabel,
  UIBadge,
  UIButton,
  UICard,
  UIInput,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import {
  createMutation,
  createQueryWithStatus,
  describeError,
  describeLoad,
} from "../integrations/convex";
import {
  evidenceStatusTone,
  formatEditorialKind,
} from "../lib/editorial-format";
import { api } from "../../../convex/_generated/api";

type EditorialArtifact = Doc<"editorialArtifacts">;
type EvidenceCard = EditorialArtifact["publicEvidenceCards"][number];
type ArtifactDraft = {
  kind: EditorialArtifact["kind"];
  title: string;
  dek: string;
  slug: string;
  bodyMd: string;
  whyItMattersMd: string;
  uncertaintyMd: string;
  whatChangedMd: string;
  evidenceStatus: EditorialArtifact["evidenceStatus"];
  visibility: EditorialArtifact["visibility"];
  publicEvidenceCards: EvidenceCard[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildDraft(artifact: EditorialArtifact): ArtifactDraft {
  return {
    kind: artifact.kind,
    title: artifact.title,
    dek: artifact.dek,
    slug: artifact.slug,
    bodyMd: artifact.bodyMd,
    whyItMattersMd: artifact.whyItMattersMd,
    uncertaintyMd: artifact.uncertaintyMd,
    whatChangedMd: artifact.whatChangedMd ?? "",
    evidenceStatus: artifact.evidenceStatus,
    visibility: artifact.visibility,
    publicEvidenceCards: artifact.publicEvidenceCards.map((card) => ({
      ...card,
    })),
  };
}

const threeColumnGrid = css({
  display: "grid",
  gap: "3",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "repeat(3, minmax(0, 1fr))",
  },
});

const headerBadgeRowClass = cx(badgeRowClass, css({ mb: "2" }));
const actionRowClass = cx(badgeRowClass, css({ mt: "4" }));
const mutedClass = css({ color: "zodiac.cream/66" });
const linkedCountsClass = css({ color: "zodiac.cream/66", mt: "1" });
const evidenceHeaderClass = cx(
  badgeRowClass,
  css({ justifyContent: "space-between" }),
);
const evidenceCardHeaderClass = cx(
  badgeRowClass,
  css({ justifyContent: "space-between", mb: "2" }),
);
const evidenceListClass = css({ display: "grid", gap: "3", mt: "3" });
const checkListClass = css({ display: "grid", gap: "2", mt: "3" });
const checkBase = { borderRadius: "l2", borderWidth: "1px", p: "3" } as const;
const checkPassClass = css({ ...checkBase, borderColor: "zodiac.success/28" });
const checkBlockClass = css({ ...checkBase, borderColor: "zodiac.error/28" });
const checkVerdictClass = css({ color: "zodiac.cream", mb: "1" });

type BusyAction = "save" | "submit" | "approve" | "publish";

const EVIDENCE_HEADING_ID = "evidence-card-review-heading";

export function EditorialDetailPage() {
  const params = useParams({ from: "/editorial/$artifactId" });
  const detailQuery = createQueryWithStatus(api.editorialArtifacts.get, () => ({
    id: params().artifactId as Id<"editorialArtifacts">,
  }));
  const detail = detailQuery.data;

  const updateArtifact = createMutation(api.editorialArtifacts.update);
  const submitForReview = createMutation(
    api.editorialArtifacts.submitForReview,
  );
  const approveArtifact = createMutation(api.editorialArtifacts.approve);
  const publishArtifact = createMutation(api.editorialArtifacts.publish);

  const [draft, setDraft] = createSignal<ArtifactDraft | null>(null);
  const [loadedVersion, setLoadedVersion] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  // The action the user activated. Its button stays enabled and focused, marked
  // aria-busy; the others are aria-disabled so none of them drops focus when a
  // run starts or when the artifact's new status makes it unavailable.
  const [busyAction, setBusyAction] = createSignal<BusyAction | null>(null);
  const blocked = (action: BusyAction) =>
    busyAction() !== null && busyAction() !== action;
  const load = describeLoad(detailQuery, "editorial artifact", () =>
    Boolean(detail()),
  );

  createEffect(() => {
    if (detailQuery.isLoading() || detail()) return;
    document.title = detailQuery.isError()
      ? "Editorial artifact unavailable — Frequency Music"
      : "Editorial artifact not found — Frequency Music";
  });

  createEffect(() => {
    const row = detail();
    if (!row) return;
    document.title = `${row.artifact.title} — Frequency Music`;
    const version = `${row.artifact._id}:${row.artifact.updatedAt}`;
    if (version === loadedVersion()) return;
    setDraft(buildDraft(row.artifact));
    setLoadedVersion(version);
  });

  const validation = createMemo(() => {
    const row = detail();
    const current = draft();
    const checks = row?.validation.checks ?? [];
    return {
      checks,
      canSubmitForReview:
        (current?.bodyMd.trim().length ?? 0) > 0 &&
        (current?.whyItMattersMd.trim().length ?? 0) > 0 &&
        (current?.uncertaintyMd.trim().length ?? 0) > 0,
      canPublish: row?.validation.canPublish ?? false,
    };
  });

  const exportPreview = createMemo(() => {
    const row = detail();
    const current = draft();
    if (!row || !current) return "";
    const slug = current.slug.trim() || slugify(current.title);
    const preview = {
      version: "public_editorial_v1",
      path: `${slug}.md`,
      frontmatter: {
        title: current.title,
        slug,
        kind: current.kind,
        publishedAt: new Date(
          row.artifact.publishedAt ?? row.artifact.updatedAt,
        ).toISOString(),
        dek: current.dek,
        evidenceStatus: current.evidenceStatus,
        uncertaintySummary: current.uncertaintyMd,
        whyItMatters: current.whyItMattersMd,
        canonicalAppUrl: `/editorial/${row.artifact._id}`,
      },
      evidenceCards: current.publicEvidenceCards,
    };
    return JSON.stringify(preview, null, 2);
  });

  function updateField<K extends keyof ArtifactDraft>(
    key: K,
    value: ArtifactDraft[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateEvidenceCard<K extends keyof EvidenceCard>(
    index: number,
    key: K,
    value: EvidenceCard[K],
  ) {
    setDraft((current) => {
      if (!current) return current;
      const nextCards = current.publicEvidenceCards.map((card, cardIndex) =>
        cardIndex === index ? { ...card, [key]: value } : card,
      );
      return { ...current, publicEvidenceCards: nextCards };
    });
  }

  function removeEvidenceCard(index: number) {
    const count = draft()?.publicEvidenceCards.length ?? 0;
    // Rows are positional (<Index>), so the row at `index` survives unless it is
    // the last one. Move focus first, onto a field that outlives the removal:
    // this position's (now the next card's) title, the previous card's title,
    // or the section heading once no cards remain.
    const focusTarget =
      index < count - 1
        ? `evidence-${index}-source-title`
        : index > 0
          ? `evidence-${index - 1}-source-title`
          : EVIDENCE_HEADING_ID;
    document.getElementById(focusTarget)?.focus();
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        publicEvidenceCards: current.publicEvidenceCards.filter(
          (_card, cardIndex) => cardIndex !== index,
        ),
      };
    });
  }

  function addEvidenceCard() {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        publicEvidenceCards: [
          ...current.publicEvidenceCards,
          {
            sourceTitle: "",
            sourceCanonicalUrl: "",
            summary: "",
            evidenceLevel: "speculative",
          },
        ],
      };
    });
  }

  async function handleSaveClick() {
    if (busyAction()) return;
    setBusyAction("save");
    try {
      await saveDraft();
    } finally {
      setBusyAction(null);
    }
  }

  // The save step of every action. Callers claim `busyAction` first, so it
  // never runs twice at once.
  async function saveDraft() {
    const current = draft();
    const row = detail();
    if (!current || !row) return false;
    setNotice(null);
    setNoticeError(null);
    const incomplete = current.publicEvidenceCards
      .map((card, index) => ({
        index,
        field: !card.sourceTitle.trim()
          ? ("source-title" as const)
          : !card.summary.trim()
            ? ("summary" as const)
            : null,
      }))
      .find((entry) => entry.field !== null);
    if (incomplete?.field) {
      const fieldName =
        incomplete.field === "source-title" ? "a source title" : "a summary";
      setNoticeError(
        `Save blocked: evidence card ${incomplete.index + 1} needs ${fieldName}.`,
      );
      return false;
    }
    try {
      await updateArtifact({
        id: row.artifact._id,
        kind: current.kind,
        title: current.title,
        dek: current.dek,
        slug: current.slug,
        bodyMd: current.bodyMd,
        whyItMattersMd: current.whyItMattersMd,
        uncertaintyMd: current.uncertaintyMd,
        whatChangedMd: current.whatChangedMd.trim() || null,
        evidenceStatus: current.evidenceStatus,
        visibility: current.visibility,
        publicEvidenceCards: current.publicEvidenceCards.map((card) => ({
          sourceTitle: card.sourceTitle.trim(),
          sourceCanonicalUrl: card.sourceCanonicalUrl?.trim() || undefined,
          summary: card.summary.trim(),
          evidenceLevel: card.evidenceLevel,
          truthConfidence: card.truthConfidence,
          interestLevel: card.interestLevel,
        })),
      });
      setNotice("Editorial artifact saved.");
      return true;
    } catch (error) {
      setNoticeError(`Save failed: ${describeError(error)}`);
      return false;
    }
  }

  // Saves the draft, then runs `action` on the saved artifact.
  async function saveThen(
    action: Exclude<BusyAction, "save">,
    allowed: boolean,
    run: (id: Id<"editorialArtifacts">) => Promise<unknown>,
    success: string,
    failure: string,
  ) {
    const row = detail();
    if (!row || busyAction() || !allowed) return;
    setBusyAction(action);
    setNotice(null);
    setNoticeError(null);
    try {
      if (!(await saveDraft())) return;
      await run(row.artifact._id);
      setNotice(success);
    } catch (error) {
      // saveDraft may already have reported success; drop it so the two live
      // regions never contradict each other for one action.
      setNotice(null);
      setNoticeError(`${failure} failed: ${describeError(error)}`);
    } finally {
      setBusyAction(null);
    }
  }

  const handleSubmitForReview = () =>
    saveThen(
      "submit",
      validation().canSubmitForReview,
      (id) => submitForReview({ id }),
      "Artifact moved to in review.",
      "Submit for review",
    );

  const handleApprove = () =>
    saveThen(
      "approve",
      detail()?.artifact.status === "in_review",
      (id) => approveArtifact({ id }),
      "Artifact approved.",
      "Approve",
    );

  const handlePublish = () =>
    saveThen(
      "publish",
      validation().canPublish,
      (id) => publishArtifact({ id }),
      "Artifact published and ready for export.",
      "Publish",
    );

  return (
    <section class={pageClass}>
      <div>
        <Link to="/editorial" class={backLink}>
          <span aria-hidden="true">&larr;</span> Editorial
        </Link>
      </div>

      <UINotice
        class={detail() && draft() ? collapsedNoticeClass : undefined}
        status={
          load.status() ??
          (detail() && !draft() ? "Loading editorial draft..." : null)
        }
        error={load.error()}
      />

      {/* Not keyed: a live update to the artifact must not remount the form and
          drop focus from the field or button the user is on. */}
      <Show when={detail()}>
        {(detailRow) => {
          const current = () => draft();
          const d = () => current()!;
          return (
            <Show when={current()}>
              <UICard>
                <div class={headerBadgeRowClass}>
                  <UIBadge tone="gold">
                    {formatEditorialKind(detailRow().artifact.kind)}
                  </UIBadge>
                  <UIBadge tone="cream">{detailRow().artifact.status}</UIBadge>
                  <UIBadge tone="cream">
                    {detailRow().artifact.visibility}
                  </UIBadge>
                  <UIBadge
                    tone={evidenceStatusTone(
                      detailRow().artifact.evidenceStatus,
                    )}
                  >
                    {detailRow().artifact.evidenceStatus}
                  </UIBadge>
                </div>

                <h1 class={detailTitleClass}>{detailRow().artifact.title}</h1>
                <p class={mutedClass}>
                  Primary ref: {detailRow().artifact.primaryRef.type}{" "}
                  {detailRow().artifact.primaryRef.id.slice(-6)}
                </p>
                <p class={linkedCountsClass}>
                  linked: {detailRow().artifact.linkedIds.thesisIds.length}{" "}
                  theses · {detailRow().artifact.linkedIds.hypothesisIds.length}{" "}
                  hypotheses · {detailRow().artifact.linkedIds.recipeIds.length}{" "}
                  recipes ·{" "}
                  {detailRow().artifact.linkedIds.compositionIds.length}{" "}
                  compositions
                </p>

                <div class={actionRowClass}>
                  <UIButton
                    variant="outline"
                    onClick={handleSaveClick}
                    aria-busy={busyAction() === "save"}
                    aria-disabled={blocked("save")}
                  >
                    {busyAction() === "save" ? "Saving..." : "Save draft"}
                  </UIButton>
                  <UIButton
                    variant="outline"
                    onClick={handleSubmitForReview}
                    aria-busy={busyAction() === "submit"}
                    aria-disabled={
                      blocked("submit") || !validation().canSubmitForReview
                    }
                  >
                    {busyAction() === "submit"
                      ? "Submitting..."
                      : "Submit for review"}
                  </UIButton>
                  <UIButton
                    variant="outline"
                    onClick={handleApprove}
                    aria-busy={busyAction() === "approve"}
                    aria-disabled={
                      blocked("approve") ||
                      detailRow().artifact.status !== "in_review"
                    }
                  >
                    {busyAction() === "approve" ? "Approving..." : "Approve"}
                  </UIButton>
                  <UIButton
                    variant="solid"
                    onClick={handlePublish}
                    aria-busy={busyAction() === "publish"}
                    aria-disabled={
                      blocked("publish") || !validation().canPublish
                    }
                  >
                    {busyAction() === "publish" ? "Publishing..." : "Publish"}
                  </UIButton>
                </div>

                <UINotice
                  class={css({ mt: "3" })}
                  status={notice()}
                  error={noticeError()}
                />
              </UICard>

              <UICard>
                <h2 class={sectionLabel}>Editorial Fields</h2>

                <label class={fieldLabelClass} for="artifact-kind">
                  Kind
                </label>
                <UISelect
                  id="artifact-kind"
                  value={d().kind}
                  onChange={(event) =>
                    updateField(
                      "kind",
                      event.currentTarget.value as EditorialArtifact["kind"],
                    )
                  }
                >
                  <option value="experiment_recap">experiment_recap</option>
                  <option value="what_changed_my_mind">
                    what_changed_my_mind
                  </option>
                  <option value="campaign_summary">campaign_summary</option>
                  <option value="thesis_summary">thesis_summary</option>
                </UISelect>

                <label class={fieldLabelClass} for="artifact-title">
                  Title
                </label>
                <UIInput
                  id="artifact-title"
                  value={d().title}
                  onInput={(event) =>
                    updateField("title", event.currentTarget.value)
                  }
                />

                <label class={fieldLabelClass} for="artifact-dek">
                  Dek
                </label>
                <UITextarea
                  id="artifact-dek"
                  value={d().dek}
                  onInput={(event) =>
                    updateField("dek", event.currentTarget.value)
                  }
                />

                <div class={threeColumnGrid}>
                  <div>
                    <label class={fieldLabelClass} for="artifact-slug">
                      Slug
                    </label>
                    <UIInput
                      id="artifact-slug"
                      value={d().slug}
                      onInput={(event) =>
                        updateField("slug", event.currentTarget.value)
                      }
                    />
                  </div>
                  <div>
                    <label
                      class={fieldLabelClass}
                      for="artifact-evidence-status"
                    >
                      Evidence Status
                    </label>
                    <UISelect
                      id="artifact-evidence-status"
                      value={d().evidenceStatus}
                      onChange={(event) =>
                        updateField(
                          "evidenceStatus",
                          event.currentTarget
                            .value as EditorialArtifact["evidenceStatus"],
                        )
                      }
                    >
                      <option value="supported">supported</option>
                      <option value="mixed">mixed</option>
                      <option value="speculative">speculative</option>
                    </UISelect>
                  </div>
                  <div>
                    <label class={fieldLabelClass} for="artifact-visibility">
                      Visibility
                    </label>
                    <UISelect
                      id="artifact-visibility"
                      value={d().visibility}
                      onChange={(event) =>
                        updateField(
                          "visibility",
                          event.currentTarget
                            .value as EditorialArtifact["visibility"],
                        )
                      }
                    >
                      <option value="private">private</option>
                      <option value="followers">followers</option>
                      <option value="public">public</option>
                    </UISelect>
                  </div>
                </div>

                <label class={fieldLabelClass} for="artifact-body">
                  Body
                </label>
                <UITextarea
                  id="artifact-body"
                  rows={18}
                  value={d().bodyMd}
                  onInput={(event) =>
                    updateField("bodyMd", event.currentTarget.value)
                  }
                />

                <label class={fieldLabelClass} for="artifact-why">
                  Why It Matters
                </label>
                <UITextarea
                  id="artifact-why"
                  rows={8}
                  value={d().whyItMattersMd}
                  onInput={(event) =>
                    updateField("whyItMattersMd", event.currentTarget.value)
                  }
                />

                <label class={fieldLabelClass} for="artifact-uncertainty">
                  Uncertainty
                </label>
                <UITextarea
                  id="artifact-uncertainty"
                  rows={8}
                  value={d().uncertaintyMd}
                  onInput={(event) =>
                    updateField("uncertaintyMd", event.currentTarget.value)
                  }
                />

                <label class={fieldLabelClass} for="artifact-what-changed">
                  What Changed
                </label>
                <UITextarea
                  id="artifact-what-changed"
                  rows={6}
                  value={d().whatChangedMd}
                  onInput={(event) =>
                    updateField("whatChangedMd", event.currentTarget.value)
                  }
                />
              </UICard>

              <UICard>
                <div class={evidenceHeaderClass}>
                  <h2
                    id={EVIDENCE_HEADING_ID}
                    tabIndex={-1}
                    class={sectionLabel}
                  >
                    Evidence Card Review
                  </h2>
                  <UIButton variant="outline" onClick={addEvidenceCard}>
                    Add evidence card
                  </UIButton>
                </div>

                <div class={evidenceListClass}>
                  <Index each={d().publicEvidenceCards}>
                    {(card, index) => (
                      <div class={entityCellClass}>
                        <div class={evidenceCardHeaderClass}>
                          <UIBadge tone="gold">Card {index + 1}</UIBadge>
                          <UIButton
                            variant="outline"
                            aria-label={`Remove card ${index + 1}`}
                            onClick={() => removeEvidenceCard(index)}
                          >
                            Remove
                          </UIButton>
                        </div>

                        <label
                          class={fieldLabelClass}
                          for={`evidence-${index}-source-title`}
                        >
                          Source Title
                        </label>
                        <UIInput
                          id={`evidence-${index}-source-title`}
                          value={card().sourceTitle}
                          onInput={(event) =>
                            updateEvidenceCard(
                              index,
                              "sourceTitle",
                              event.currentTarget.value,
                            )
                          }
                        />

                        <label
                          class={fieldLabelClass}
                          for={`evidence-${index}-canonical-url`}
                        >
                          Canonical URL
                        </label>
                        <UIInput
                          id={`evidence-${index}-canonical-url`}
                          value={card().sourceCanonicalUrl ?? ""}
                          onInput={(event) =>
                            updateEvidenceCard(
                              index,
                              "sourceCanonicalUrl",
                              event.currentTarget.value,
                            )
                          }
                        />

                        <label
                          class={fieldLabelClass}
                          for={`evidence-${index}-summary`}
                        >
                          Summary
                        </label>
                        <UITextarea
                          id={`evidence-${index}-summary`}
                          rows={5}
                          value={card().summary}
                          onInput={(event) =>
                            updateEvidenceCard(
                              index,
                              "summary",
                              event.currentTarget.value,
                            )
                          }
                        />

                        <div class={threeColumnGrid}>
                          <div>
                            <label
                              class={fieldLabelClass}
                              for={`evidence-${index}-evidence-level`}
                            >
                              Evidence Level
                            </label>
                            <UISelect
                              id={`evidence-${index}-evidence-level`}
                              value={card().evidenceLevel}
                              onChange={(event) =>
                                updateEvidenceCard(
                                  index,
                                  "evidenceLevel",
                                  event.currentTarget
                                    .value as EvidenceCard["evidenceLevel"],
                                )
                              }
                            >
                              <option value="peer_reviewed">
                                peer_reviewed
                              </option>
                              <option value="preprint">preprint</option>
                              <option value="anecdotal">anecdotal</option>
                              <option value="speculative">speculative</option>
                              <option value="personal">personal</option>
                            </UISelect>
                          </div>
                          <div>
                            <label
                              class={fieldLabelClass}
                              for={`evidence-${index}-truth-confidence`}
                            >
                              Truth Confidence
                            </label>
                            <UISelect
                              id={`evidence-${index}-truth-confidence`}
                              value={card().truthConfidence ?? ""}
                              onChange={(event) =>
                                updateEvidenceCard(
                                  index,
                                  "truthConfidence",
                                  (event.currentTarget.value ||
                                    undefined) as EvidenceCard["truthConfidence"],
                                )
                              }
                            >
                              <option value="">unset</option>
                              <option value="low">low</option>
                              <option value="medium">medium</option>
                              <option value="high">high</option>
                            </UISelect>
                          </div>
                          <div>
                            <label
                              class={fieldLabelClass}
                              for={`evidence-${index}-interest-level`}
                            >
                              Interest Level
                            </label>
                            <UISelect
                              id={`evidence-${index}-interest-level`}
                              value={card().interestLevel ?? ""}
                              onChange={(event) =>
                                updateEvidenceCard(
                                  index,
                                  "interestLevel",
                                  (event.currentTarget.value ||
                                    undefined) as EvidenceCard["interestLevel"],
                                )
                              }
                            >
                              <option value="">unset</option>
                              <option value="low">low</option>
                              <option value="medium">medium</option>
                              <option value="high">high</option>
                            </UISelect>
                          </div>
                        </div>
                      </div>
                    )}
                  </Index>
                </div>
              </UICard>

              <UICard>
                <h2 class={sectionLabel}>Pre-publish Checklist</h2>
                <div class={checkListClass}>
                  <For each={validation().checks}>
                    {(check) => (
                      <div class={check.ok ? checkPassClass : checkBlockClass}>
                        <div class={checkVerdictClass}>
                          {check.ok ? "Pass" : "Block"}
                        </div>
                        <div class={mutedClass}>{check.message}</div>
                      </div>
                    )}
                  </For>
                </div>
              </UICard>

              <UICard>
                <h2 class={sectionLabel}>Export Preview</h2>
                <hr class={goldDivider} />
                <pre
                  role="group"
                  tabIndex={0}
                  aria-label="Export preview JSON"
                  class={cx(jsonBlockClass, "zodiac-scroll")}
                >
                  {exportPreview()}
                </pre>
              </UICard>
            </Show>
          );
        }}
      </Show>
    </section>
  );
}
