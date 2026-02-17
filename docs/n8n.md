# n8n Workflows — Concrete Node-by-Node Plan

## Shared setup
- Store these as n8n credentials/env vars:
  - `CONVEX_INGEST_BASE_URL`
  - `CONVEX_INGEST_SECRET`
  - `NOTION_API_KEY`
  - `NOTION_DB_ID_NOTES`
- Maintain a “cursor” (last sync time) using n8n static data or a small KV store.

---

## Workflow 1: Notion → Convex (Scheduled)
Trigger:
- Cron: every 30 minutes

Nodes:
1) **Function: Load cursor**
   - read `lastEditedAfter` (ms epoch); default = now - 7 days on first run

2) **Notion: Query database**
   - Database: Notes
   - Filter:
     - Tags contains `ResonantProjects` (or whatever you name it)
     - last_edited_time > cursor
   - Sort by last_edited_time ascending

3) **Split In Batches** (batch size 10)

4) **Notion: Retrieve page content**
   - For each page: fetch blocks
   - Convert rich text → plain text (use a Function node to flatten)

5) **HTTP Request: POST /ingest/notion**
   - JSON body includes:
     - secret
     - notionPageId
     - title
     - tags
     - lastEditedAt
     - contentText
     - sourceUrl (if you store one)

6) **Function: Update cursor**
   - set cursor to max(lastEditedAt) processed

7) **No-op / Logging**
   - write summary to n8n execution log

Failure handling:
- If a page fails, continue; log pageId and error.
- Next run will pick it up again because cursor moves only after success.

---

## Workflow 2: RSS → Convex (Scheduled)
Trigger:
- Cron: every 6 hours

Nodes:
1) RSS Read (for each feed URL) OR multiple RSS nodes
2) Merge results
3) Filter new items
   - Maintain a per-feed GUID cache (static data)
4) HTTP POST /ingest/rssItem
5) Update per-feed GUID cache

Optional add-on:
- If you want n8n to also fetch readability text:
  - add HTTP fetch page → HTML → readability node (or custom function)
  - pass `summaryText` to Convex

---

## Workflow 3: “Manual Drop” (Webhook) — Optional
If you want to send yourself items quickly:
- n8n webhook that accepts { url } or { youtubeUrl }
- then calls Convex /ingest/url
This lets you drop links from phone/shortcuts without opening the app.
