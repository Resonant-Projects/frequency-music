import { describe, expect, test } from "vite-plus/test";
import { collectQueueEvidence } from "./frequency-queue-evidence";
import { queueFailureReport } from "./queue-diagnostics";

const origin = "https://convex.resonantprojects.art";
const privateText = "secret-payload-private-worker-untrusted-error";

async function rejectedResponse(response: Response, timestamp = false) {
  let requests = 0;
  const transport: typeof fetch = async () => {
    requests++;
    if (!timestamp && requests === 1)
      return Response.json({ ts: "private-timestamp" });
    return response;
  };
  try {
    await collectQueueEvidence(origin, "inert-private-key", 100, transport);
    throw new Error("Expected failure");
  } catch (error) {
    const report = queueFailureReport(error);
    expect(JSON.stringify(report)).not.toMatch(
      /secret|payload|worker|untrusted|private-timestamp|inert-private-key/,
    );
    expect(report.complete).toBe(false);
    return { report, requests };
  }
}

describe("bounded redacted queue diagnostics", () => {
  test("HTTP200 function error is distinct from missing query or malformed page", async () => {
    const { report, requests } = await rejectedResponse(
      Response.json({
        status: "error",
        errorMessage: privateText,
        errorData: { privateText },
        logLines: [privateText],
      }),
    );
    expect(report).toEqual({
      complete: false,
      code: "convex_error",
      stage: "query",
      pageNumber: 1,
      httpStatus: 200,
      envelope: "error",
    });
    expect(requests).toBe(2);
  });
  test.each([
    ["null", "invalid_envelope"],
    [privateText, "invalid_json"],
    [JSON.stringify({ status: privateText }), "invalid_envelope"],
    [JSON.stringify({ status: "success", value: null }), "invalid_page_shape"],
    [
      JSON.stringify({ status: "success", value: { privateText } }),
      "invalid_page_shape",
    ],
    [
      JSON.stringify({ status: "success", value: { $integer: privateText } }),
      "value_decode_failure",
    ],
  ])("classifies response without echoing body: %s", async (body, code) => {
    const { report } = await rejectedResponse(new Response(body));
    expect(report.code).toBe(code);
  });
  test("caps response bytes", async () => {
    const { report } = await rejectedResponse(
      new Response(privateText.repeat(4000)),
    );
    expect(report.code).toBe("response_too_large");
  });
  test("HTTP denial does not emit a backend error body", async () => {
    const { report } = await rejectedResponse(
      new Response(privateText, { status: 403 }),
    );
    expect(report).toMatchObject({ code: "http_failure", httpStatus: 403 });
  });
  test("malformed timestamp is distinguished before any page request", async () => {
    const { report, requests } = await rejectedResponse(
      Response.json({ ts: null, privateText }),
      true,
    );
    expect(report).toMatchObject({
      code: "invalid_timestamp",
      stage: "timestamp",
    });
    expect(requests).toBe(1);
  });
  test("unknown local errors are not serialized", () => {
    expect(queueFailureReport(new Error(privateText))).toEqual({
      complete: false,
      code: "invalid_input",
      stage: "input",
      pageNumber: 0,
    });
  });
});
