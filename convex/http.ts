import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { generateDedupeKey } from "./sources";

const http = httpRouter();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function getConfiguredSecret() {
  return process.env.INGEST_SHARED_SECRET ?? process.env.N8N_INGEST_SECRET;
}

function isAuthorized(request: Request, payloadSecret?: string): boolean {
  const expected = getConfiguredSecret();
  if (!expected) return true;

  const authHeader = request.headers.get("x-ingest-secret") ?? undefined;
  const candidate = payloadSecret ?? authHeader;
  return Boolean(candidate && candidate === expected);
}

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => json({ ok: true })),
});

http.route({
  path: "/ingest/notion",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payload = (await request.json()) as {
      secret?: string;
      notionPageId: string;
      title?: string;
      tags?: string[];
      lastEditedAt?: number;
      contentText?: string;
      sourceUrl?: string;
    };

    if (!payload?.notionPageId) {
      return json({ error: "notionPageId is required" }, 400);
    }

    if (!isAuthorized(request, payload.secret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const result = await ctx.runMutation(api.sources.upsertExternal, {
      dedupeKey: generateDedupeKey("notion", {
        notionPageId: payload.notionPageId,
      }),
      type: "notion",
      title: payload.title,
      notionPageId: payload.notionPageId,
      canonicalUrl: payload.sourceUrl,
      rawText: payload.contentText,
      tags: payload.tags,
      metadata: {
        lastEditedAt: payload.lastEditedAt,
      },
    });

    return json({ ok: true, ...result });
  }),
});

http.route({
  path: "/ingest/rssItem",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payload = (await request.json()) as {
      secret?: string;
      feedUrl: string;
      guid: string;
      title?: string;
      link?: string;
      publishedAt?: number;
      summaryText?: string;
    };

    if (!payload?.feedUrl || !payload?.guid) {
      return json({ error: "feedUrl and guid are required" }, 400);
    }

    if (!isAuthorized(request, payload.secret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const result = await ctx.runMutation(api.sources.upsertExternal, {
      dedupeKey: generateDedupeKey("rss", {
        feedUrl: payload.feedUrl,
        rssGuid: payload.guid,
        canonicalUrl: payload.link,
      }),
      type: "rss",
      title: payload.title,
      canonicalUrl: payload.link,
      publishedAt: payload.publishedAt,
      feedUrl: payload.feedUrl,
      rssGuid: payload.guid,
      rawText: payload.summaryText,
    });

    return json({ ok: true, ...result });
  }),
});

http.route({
  path: "/ingest/url",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payload = (await request.json()) as {
      secret?: string;
      url: string;
      title?: string;
      rawText?: string;
      tags?: string[];
    };

    if (!payload?.url) {
      return json({ error: "url is required" }, 400);
    }

    if (!isAuthorized(request, payload.secret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const result = await ctx.runMutation(api.sources.upsertExternal, {
      dedupeKey: generateDedupeKey("url", { canonicalUrl: payload.url }),
      type: "url",
      title: payload.title,
      canonicalUrl: payload.url,
      rawText: payload.rawText,
      tags: payload.tags,
    });

    return json({ ok: true, ...result });
  }),
});

export default http;
