import { Link, useParams } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import {
  UIBadge,
  UIButton,
  UICard,
  UISelect,
  UITextarea,
  backLink,
  detailTitleClass,
  fieldLabelClass,
  goldDivider,
  metaLine,
  pageClass,
  sectionLabel,
} from "../components/ui";
import { createMutation, createQueryWithStatus } from "../integrations/convex";

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

  function beginReview(current: CorrespondenceStatus) {
    setNextStatus(current === "conjectured" ? "evidenced" : current);
    setStatusReason("");
    setNotice(null);
    setReviewOpen(true);
  }

  async function confirmStatus() {
    const row = correspondence.data();
    const reason = statusReason().trim();
    if (!row || !reason) return;
    setSaving(true);
    setNotice(null);
    try {
      await setStatus({
        correspondenceId: row._id,
        status: nextStatus(),
        statusReason: reason,
      });
      setReviewOpen(false);
      setStatusReason("");
      setNotice(`Status set to ${nextStatus()}.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to update status.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section class={pageClass}>
      <div>
        <Link to="/correspondences" class={backLink}>
          <span aria-hidden="true">&larr;</span> Correspondences
        </Link>
      </div>
      <Show
        when={correspondence.data()}
        fallback={
          <UICard>
            <p class={css({ color: "zodiac.cream" })}>
              {correspondence.isLoading()
                ? "Loading correspondence…"
                : correspondence.error()
                  ? `Unable to load correspondence: ${correspondence.error()?.message}`
                  : "Correspondence not found."}
            </p>
          </UICard>
        }
      >
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
              >
                Review lifecycle
              </UIButton>
            </div>

            <Show when={reviewOpen()}>
              <div
                role="dialog"
                aria-modal="false"
                aria-label="Review correspondence lifecycle"
                class={css({
                  bg: "rgba(139, 92, 246, 0.07)",
                  borderColor: "rgba(139, 92, 246, 0.3)",
                  borderRadius: "l2",
                  borderWidth: "1px",
                  display: "grid",
                  gap: "2",
                  mt: "3",
                  p: "3",
                })}
              >
                <p class={css({ color: "rgba(245, 240, 232, 0.7)" })}>
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
                  id="correspondence-status-reason"
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

            <Show when={notice()}>
              {(message) => (
                <p
                  aria-live="polite"
                  class={css({ color: "zodiac.cream", mt: "2" })}
                >
                  {message()}
                </p>
              )}
            </Show>

            <hr class={goldDivider} />
            <div class={sectionLabel}>Rationale</div>
            <p
              class={css({
                color: "rgba(245, 240, 232, 0.76)",
                fontSize: "lg",
                lineHeight: "1.65",
                maxWidth: "72ch",
              })}
            >
              {row().rationaleMd}
            </p>

            <Show when={row().statusReason}>
              {(reason) => (
                <>
                  <hr class={goldDivider} />
                  <div class={sectionLabel}>Status reason</div>
                  <p class={css({ color: "rgba(245, 240, 232, 0.76)" })}>
                    {reason()}
                  </p>
                </>
              )}
            </Show>

            <Show when={row().evidence.length > 0}>
              <hr class={goldDivider} />
              <div class={sectionLabel}>Evidence</div>
              <div class={css({ display: "grid", gap: "2" })}>
                <For each={row().evidence}>
                  {(citation) => (
                    <div
                      class={css({
                        borderBottom: "1px solid rgba(200, 168, 75, 0.16)",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2",
                        justifyContent: "space-between",
                        py: "2",
                      })}
                    >
                      <span>{citation.note ?? String(citation.claimId)}</span>
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
