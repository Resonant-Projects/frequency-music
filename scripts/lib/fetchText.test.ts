import { describe, expect, test } from "vite-plus/test";
import { MIN_TEXT_LENGTH, TEXT_CAP, capText, fetchViaJina } from "./fetchText";

function fakeFetch(status: number, body: string): typeof fetch {
  return (() =>
    Promise.resolve(new Response(body, { status }))) as unknown as typeof fetch;
}

describe("fetchViaJina", () => {
  test("returns trimmed text on success", async () => {
    const result = await fetchViaJina("https://example.com/a", {
      fetchImpl: fakeFetch(200, "  hello world  \n"),
    });
    expect(result).toEqual({ ok: true, text: "hello world" });
  });

  test("returns ok:false with status on non-ok response", async () => {
    const result = await fetchViaJina("https://example.com/a", {
      fetchImpl: fakeFetch(451, ""),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("451");
  });

  test("returns ok:false when fetch throws", async () => {
    const throwing = (() =>
      Promise.reject(new Error("boom"))) as unknown as typeof fetch;
    const result = await fetchViaJina("https://example.com/a", {
      fetchImpl: throwing,
    });
    expect(result).toEqual({ ok: false, error: "boom" });
  });

  test("targets the Jina reader URL", async () => {
    let seenUrl = "";
    const spy = ((input: string | Request | URL) => {
      seenUrl = String(input);
      return Promise.resolve(new Response("text", { status: 200 }));
    }) as unknown as typeof fetch;
    await fetchViaJina("https://example.com/article?x=1", { fetchImpl: spy });
    expect(seenUrl).toBe("https://r.jina.ai/https://example.com/article?x=1");
  });
});

describe("capText", () => {
  test("returns undefined below MIN_TEXT_LENGTH", () => {
    expect(capText("x".repeat(MIN_TEXT_LENGTH - 1))).toBeUndefined();
  });

  test("returns text at exactly MIN_TEXT_LENGTH", () => {
    const text = "x".repeat(MIN_TEXT_LENGTH);
    expect(capText(text)).toBe(text);
  });

  test("caps at TEXT_CAP", () => {
    const result = capText("x".repeat(TEXT_CAP + 5000));
    expect(result?.length).toBe(TEXT_CAP);
  });
});
