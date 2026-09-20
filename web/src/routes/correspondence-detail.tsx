import { Link, useParams } from "@tanstack/solid-router";
import { createEffect, createSignal, For, on, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  backLink,
  collapsedNoticeClass,
  detailTitleClass,
  fieldLabelClass,
  goldDivider,
  Markdown,
  metaLine,
  pageClass,
  sectionLabel,
  UIBadge,
  UIButton,
  UICard,
  UINotice,
  UISelect,
  UITextarea,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";

/** Wrapper for an always-mounted notice that currently carries no text. */
type CorrespondenceStatus =
  | "conjectured"
  | "evidenced"
  | "contradicted"
  | "retired";

export function CorrespondenceDetailPage() {
  const params = useParams({ from: "/correspondences/$correspondenceId" });
  const correspondence = createQueryWithStatus(api.correspondences.get, () => ({
    id: params().correspondenceId as Id<"correspondences">,
  }));
  const setStatus = createMutation(api.correspondences.setStatus);
  const [reviewOpen, setReviewOpen] = createSignal(false);
  const [nextStatus, setNextStatus] =
    createSignal<CorrespondenceStatus>("evidenced");
  const [statusReason, setStatusReason] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [noticeError, setNoticeError] = createSignal<string | null>(null);
  let reasonField: HTMLTextAreaElement | undefined;

  createEffect(
    on(
      () => params().correspondenceId,
      () => {
        setReviewOpen(false);
        setNextStatus("evidenced");
        setStatusReason("");
        setSaving(false);
        setNotice(null);
        setNoticeError(null);
      },
    ),
  );

  function beginReview(current: CorrespondenceStatus) {
    setNextStatus(current === "conjectured" ? "evidenced" : current);
    setStatusReason("");
    setNotice(null);
    setNoticeError(null);
    setReviewOpen(true);
    queueMicrotask(() => reasonField?.focus());
  }

  async function confirmStatus() {
    const row = correspondence.data();
    const reason = statusReason().trim();
    if (!row || !reason) return;
    const submittedCorrespondenceId = row._id;
    const submittedStatus = nextStatus();
    const isCurrentCorrespondence = () =>
      params().correspondenceId === String(submittedCorrespondenceId);
    setSaving(true);
    setNotice(null);
    setNoticeError(null);
    try {
      await setStatus({
        correspondenceId: submittedCorrespondenceId,
        status: submittedStatus,
        statusReason: reason,
      });
      if (isCurrentCorrespondence()) {
        setReviewOpen(false);
        setStatusReason("");
        setNotice(`Status set to ${submittedStatus}.`);
      }
    } catch (error) {
      if (isCurrentCorrespondence()) {
        setNoticeError(
          error instanceof Error ? error.message : "Unable to update status.",
        );
      }
    } finally {
      if (isCurrentCorrespondence()) setSaving(false);
    }
  }

  const loadError = () =>
    correspondence.error()
      ? `Unable to load correspondence: ${correspondence.error()?.message}`
      : null;
  const loadStatus = () => {
    if (correspondence.error() || correspondence.data()) return null;
    return correspondence.isLoading()
      ? "Loading correspondence…"
      : "Correspondence not found.";
  };

  return (
    <section class={pageClass}>
      <div>
        <Link to="/correspondences" class={backLink}>
          <span aria-hidden="true">&larr;</span> Correspondences
        </Link>
      </div>
      <UICard class={correspondence.data() ? collapsedNoticeClass : undefined}>
        <UINotice status={loadStatus()} error={loadError()} />
      </UICard>
      <Show when={correspondence.data()}>
        {(row) => (
          <UICard>
            <div class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}>
              <UIBadge tone="violet">Correspondence</UIBadge>
              <UIBadge tone="cream">{row().status}</UIBadge>
              <UIBadge tone="violet">{row().evidence.length} evidence</UIBadge>
            </div>
            <h1 class={detailTitleClass}>{row().statement}</h1>
            <p class={metaLine}>pair: {row().pairKey}</p>

            <div class={css({ display: "flex", gap: "2", mt: "3" })}>
              <UIButton
                variant="outline"
                onClick={() => beginReview(row().status)}
                disabled={saving()}
                aria-expanded={reviewOpen()}
                aria-controls="correspondence-review-panel"
              >
                Review lifecycle
              </UIButton>
            </div>

            <Show when={reviewOpen()}>
              <div
                id="correspondence-review-panel"
                role="dialog"
                aria-modal="false"
                aria-label="Review correspondence lifecycle"
                class={css({
                  bg: "zodiac.violet/7",
                  borderColor: "zodiac.violet/30",
                  borderRadius: "l2",
                  borderWidth: "1px",
                  display: "grid",
                  gap: "2",
                  mt: "3",
                  p: "3",
                })}
              >
                <p class={css({ color: "zodiac.cream/70" })}>
                  Confirm evidence, record contradiction, retire this
                  correspondence, or explicitly override it back to conjectured.
                </p>
                <label class={fieldLabelClass} for="correspondence-next-status">
                  Lifecycle status
                </label>
                <UISelect
                  id="correspondence-next-status"
                  value={nextStatus()}
                  onChange={(event) =>
                    setNextStatus(
                      event.currentTarget.value as CorrespondenceStatus,
                    )
                  }
                >
                  <option value="conjectured">Conjectured (override)</option>
                  <option value="evidenced">Evidenced (confirm)</option>
                  <option value="contradicted">Contradicted</option>
                  <option value="retired">Retired</option>
                </UISelect>
                <label
                  class={fieldLabelClass}
                  for="correspondence-status-reason"
                >
                  Decision note (required)
                </label>
                <UITextarea
                  ref={(element) => {
                    reasonField = element;
                  }}
                  id="correspondence-status-reason"
                  aria-required="true"
                  value={statusReason()}
                  onInput={(event) =>
                    setStatusReason(event.currentTarget.value)
                  }
                  placeholder="Record why this lifecycle decision is warranted."
                />
                <div
                  class={css({ display: "flex", flexWrap: "wrap", gap: "2" })}
                >
                  <UIButton
                    variant="solid"
                    disabled={saving() || statusReason().trim().length === 0}
                    onClick={confirmStatus}
                  >
                    {saving() ? "Saving…" : "Confirm decision"}
                  </UIButton>
                  <UIButton
                    variant="ghost"
                    disabled={saving()}
                    onClick={() => setReviewOpen(false)}
                  >
                    Cancel
                  </UIButton>
                </div>
              </div>
            </Show>

            <UINotice
              class={css({ mt: "2" })}
              status={notice()}
              error={noticeError()}
            />

            <hr class={goldDivider} />
            <h2 class={sectionLabel}>Rationale</h2>
            <div
              class={css({
                color: "zodiac.cream/76",
                fontSize: "lg",
                lineHeight: "1.65",
                maxWidth: "72ch",
              })}
            >
              <Markdown content={row().rationaleMd} />
            </div>

            <Show when={row().statusReason}>
              {(reason) => (
                <>
                  <hr class={goldDivider} />
                  <h2 class={sectionLabel}>Status reason</h2>
                  <p class={css({ color: "zodiac.cream/76" })}>{reason()}</p>
                </>
              )}
            </Show>

            <Show when={row().evidence.length > 0}>
              <hr class={goldDivider} />
              <h2 class={sectionLabel}>Evidence</h2>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().evidence}>
                  {(citation) => (
                    <div
                      class={css({
                        borderBottomWidth: "1px",
                        borderBottomStyle: "solid",
                        borderBottomColor: "zodiac.gold/16",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2",
                        justifyContent: "space-between",
                        py: "2",
                      })}
                    >
                      <span class={css({ overflowWrap: "anywhere" })}>
                        {citation.note ?? String(citation.claimId)}
                      </span>
                      <span class={metaLine}>
                        {citation.stance} · {citation.addedBy}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </UICard>
        )}
      </Show>
    </section>
  );
}
