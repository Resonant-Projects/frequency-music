import { deliverOrSpool } from "../../shared/outbox.js";
import type { CaptureInput } from "../../../../convex/shared/operationRecovery";
import {
  createCrawlPage,
  type CrawledPage,
  type PageHint,
} from "../../tools/crawlTool.js";
import { callConvex } from "../../tools/convexTools.js";
import {
  appendRemoteAuditEvent,
  type AgentAuditEvent,
  type ToolCaller,
} from "../shared/audit.js";
import { redactError } from "../../shared/redactError.js";

export type CaptureAttemptResult = {
  id?: string;
  created: boolean;
  enriched: boolean;
  failed: boolean;
  auditEvents: AgentAuditEvent[];
};
/** Own capture, trusted provenance, result validation, and failure reporting. */
export async function captureSourceAttempt(
  args: {
    agentRunId: string;
    input: CaptureInput;
    page?: CrawledPage | null;
    skipCapture?: boolean;
    reportFailure?: boolean;
  },
  callTool: ToolCaller = callConvex,
  crawl: (
    url: string,
    hint?: PageHint,
  ) => Promise<CrawledPage | null> = createCrawlPage(),
): Promise<CaptureAttemptResult> {
  let page = args.page;
  let stage: "capture" | "intake" = "capture";
  const auditEvents: AgentAuditEvent[] = [];
  const input = { ...args.input };
  let diagnostic: string | undefined;
  try {
    if (!input.rawText && !args.skipCapture && page === undefined) {
      try {
        page = await crawl(input.url, { title: input.title });
      } catch (error) {
        diagnostic = redactError(error).slice(0, 1000);
        auditEvents.push(
          ...(await appendRemoteAuditEvent(
            callTool,
            args.agentRunId,
            "error",
            "Source scout capture failed",
            { url: input.url, error: redactError(error) },
          )),
        );
        page = null;
      }
    }
    if (page) {
      input.rawText = page.text;
      input.contentProvider = page.provider;
    }
    stage = "intake";
    const raw = await callTool("ingestScoutedSource", {
      ...input,
      agentRunId: args.agentRunId,
    });
    const result = raw as {
      id?: unknown;
      created?: unknown;
      enriched?: unknown;
    } | null;
    if (typeof result?.id !== "string")
      throw new Error("Source Intake returned no Source id");
    const failed = !args.skipCapture && !input.rawText;
    if (failed) await report("capture");
    return {
      id: result.id,
      created: result.created === true,
      enriched: result.enriched === true,
      failed,
      auditEvents,
    };
  } catch (error) {
    diagnostic = redactError(error).slice(0, 1000);
    auditEvents.push(
      ...(await appendRemoteAuditEvent(
        callTool,
        args.agentRunId,
        "error",
        `Source scout ${stage} failed`,
        { url: input.url, error: redactError(error) },
      )),
    );
    await report(stage);
    return { created: false, enriched: false, failed: true, auditEvents };
  }
  async function report(failedStage: "capture" | "intake") {
    if (args.reportFailure === false) return;
    const failed = await deliverOrSpool(callTool, "reportCaptureFailure", {
      agentRunId: args.agentRunId,
      input,
      stage: failedStage,
      ...(diagnostic ? { diagnostic } : {}),
    });
    if (failed)
      auditEvents.push(
        ...(await appendRemoteAuditEvent(
          callTool,
          args.agentRunId,
          "error",
          "Could not persist capture failure",
          { url: input.url, error: redactError(failed.error) },
        )),
      );
  }
}
