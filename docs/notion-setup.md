# Notion Integration Setup for Weekly Briefs

The `publishToNotion` action in `convex/weeklyBriefs.ts` requires two environment variables set in Convex.

## 1. Create a Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it something like "Frequency Music Pipeline"
4. Select the workspace where your weekly briefs database lives
5. Copy the **Internal Integration Secret** (starts with `ntn_`)

## 2. Create (or identify) the Target Database

The Notion database needs these properties:

| Property | Type      | Notes                                        |
| -------- | --------- | -------------------------------------------- |
| Name     | Title     | Auto-filled with "Weekly Brief — YYYY-MM-DD" |
| Week Of  | Date      | ISO date of the Monday                       |
| Model    | Rich text | e.g. "anthropic/claude-sonnet-4-6"           |

Additional properties are optional -- the action only writes the three above plus the page body (headings, paragraphs, bullet lists converted from the brief's markdown).

## 3. Share the Database with the Integration

1. Open the target database in Notion
2. Click "..." menu (top right) > "Connections" > find your integration > "Connect"

Without this step the API will return a 403.

## 4. Get the Database ID

From the database URL:

```
https://www.notion.so/<workspace>/<database_id>?v=...
```

The database ID is the 32-character hex string before the `?v=` query param. Format it with dashes or without -- Notion accepts both.

## 5. Set Convex Environment Variables

```bash
bunx convex env set NOTION_API_KEY "ntn_..."
bunx convex env set NOTION_WEEKLY_BRIEFS_DB "<database-id>"
```

## 6. Verify

Click "Publish to Notion" on any private weekly brief in the UI at `/weekly-turns/<id>`. The brief should appear in the Notion database and the brief's visibility should flip to "public".
