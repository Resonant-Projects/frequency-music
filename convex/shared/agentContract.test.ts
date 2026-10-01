import { describe, expect, test } from "vite-plus/test";
import { agentRunEventKindValidator, agentRunStatusValidator } from "../schema";
import {
  AGENT_RUN_EVENT_KINDS,
  AGENT_RUN_STATUSES,
  HEARTBEAT_INTERVAL_MS,
  KNOWN_GRAPH_NAMES,
  PENDING_DRAFT_CAP,
  STALE_RUN_MS,
  TERMINAL_STATUS_OWNER,
} from "./agentContract";
import { AGENT_RUN_STATUSES as STATUS_SOURCE } from "./statuses";

describe("agentContract", () => {
  test("event kinds match the canonical nine-member contract", () => {
    expect(AGENT_RUN_EVENT_KINDS).toEqual([
      "tool_call",
      "decision",
      "draft_write",
      "error",
      "review_request",
      "status",
      "node",
      "memory_recall",
      "model_call",
    ]);
  });

  test("run statuses come from shared statuses", () => {
    expect(AGENT_RUN_STATUSES).toBe(STATUS_SOURCE);
    expect(AGENT_RUN_STATUSES).toEqual([
      "queued",
      "running",
      "needs_review",
      "completed",
      "failed",
      "cancelled",
    ]);
  });

  test("a healthy worker can never be swept", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(STALE_RUN_MS);
    expect(STALE_RUN_MS / HEARTBEAT_INTERVAL_MS).toBeGreaterThanOrEqual(2);
  });

  test("pending hypothesis draft work is capped at three", () => {
    expect(PENDING_DRAFT_CAP).toBe(3);
  });

  test("every known graph has a terminal-status owner", () => {
    for (const name of KNOWN_GRAPH_NAMES) {
      expect(["graph", "runner"]).toContain(TERMINAL_STATUS_OWNER[name]);
    }
  });
});

describe("schema validators derive from agentContract", () => {
  test("event-kind members equal the shared contract", () => {
    const members = (
      agentRunEventKindValidator as unknown as {
        members: Array<{ value: string }>;
      }
    ).members.map((member) => member.value);

    expect(members).toEqual([...AGENT_RUN_EVENT_KINDS]);
  });

  test("run-status members equal the shared contract", () => {
    const members = (
      agentRunStatusValidator as unknown as {
        members: Array<{ value: string }>;
      }
    ).members.map((member) => member.value);

    expect(members).toEqual([...AGENT_RUN_STATUSES]);
  });
});

describe("Source Scout bot-challenge filter", () => {
  test("recognizes browser checks crawlers report as pages", async () => {
    const { looksLikeBotChallenge } = await import("./agentContract");
    // Captured by both Crawl4AI and Firecrawl from JSTOR on 2026-09-30.
    const jstor =
      "A required part of this site couldn’t load. This may be due to a browser extension, network issues, or browser settings. Please check your connection, disable any ad blockers, or try using a different browser. \nis verifying your browser...";
    for (const text of [
      jstor,
      "# Just a moment...\nEnable JavaScript and cookies to continue",
      "Attention Required! | Cloudflare\nPlease complete the security check to access example.org",
      "Please enable JS and disable any ad blocker. captcha-delivery.com DataDome",
      "Access denied. You don't have permission to access this page. Reference #18.4f2",
      "Please complete the CAPTCHA to continue.",
      "Are you a robot? Press & hold to confirm you are a human.",
      // Elsevier ScienceDirect block page captured by Crawl4AI on 2026-10-01.
      "[ScienceDirect](https://www.sciencedirect.com/)\n  * Help\n\n# There was a problem providing the content you requested\nPlease [contact our support team](https://service.elsevier.com/) for more information and provide the details below.\n  * **Reference number:** a1b2c3",
      "Access to this page has been denied because we believe you are using automation tools to browse the website.",
      "The requested URL was rejected. Please consult with your administrator. Your support ID is: 1234567890",
      // HAL's Anubis gate captured by Crawl4AI on 2026-10-01.
      "sciences sciences\n# Making sure you're not a bot!\nLoading...\nYou are seeing this because the administrator of this website has set up Anubis to protect the server against the scourge of AI companies aggressively scraping websites. Anubis uses a Proof-of-Work scheme in the vein of Hashcash.",
      // Cloudflare challenge in a Medium capture, through a Markdown reader.
      "Title: Just a moment...\n\nURL Source: https://ai.gopubby.com/example\n\nMarkdown Content:\nai.gopubby.com\n--------------\n\nPerforming security verification\n--------------------------------\n\nThis website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.",
      "Performing security verification\nThis website uses a security service to protect against malicious bots.",
      // Cloudflare's failure page in a bepress repository capture.
      "Max challenge attempts exceeded. Please refresh the page to try again!\nWe use cookies that are necessary to make our site work.",
    ]) {
      expect(looksLikeBotChallenge(text), text.slice(0, 40)).toBe(true);
    }
  });

  test("keeps real text, including long articles about CAPTCHAs", async () => {
    const { looksLikeBotChallenge } = await import("./agentContract");
    expect(
      looksLikeBotChallenge(
        "# Measured resonant modes\nThe plate was excited at 440 Hz. ".repeat(
          3,
        ),
      ),
    ).toBe(false);
    const article =
      "Why CAPTCHA tests ask you to verify you are human. " +
      "Researchers studied browser checks and bot walls. ".repeat(80);
    expect(article.length).toBeGreaterThan(3_000);
    expect(looksLikeBotChallenge(article)).toBe(false);
    // A short article about the Anubis tool itself is real text.
    expect(
      looksLikeBotChallenge(
        "Anubis is an open-source web firewall that asks browsers to solve a proof-of-work challenge before serving pages. " +
          "Archives such as HAL adopted Anubis in 2025 to limit aggressive AI scraping. ".repeat(
            2,
          ),
      ),
    ).toBe(false);
    // A short page naming Cloudflare's challenge heading is real text.
    expect(
      looksLikeBotChallenge(
        "Cloudflare's interstitial, headed 'Performing security verification', drew complaints from screen-reader users. " +
          "Some readers saw max challenge attempts exceeded errors on slow links. ".repeat(
            2,
          ),
      ),
    ).toBe(false);
    // A short page that merely quotes a block-page phrase is real text.
    expect(
      looksLikeBotChallenge(
        "Troubleshooting web firewalls: when a WAF responds that the requested URL was rejected, check the policy's signature set and the request path. " +
          "Access to this page has been denied is another message operators see. ".repeat(
            2,
          ),
      ),
    ).toBe(false);
    // A short abstract page about CAPTCHAs or access control is real text.
    expect(
      looksLikeBotChallenge(
        "# CAPTCHA: Using Hard AI Problems for Security\nWe introduce CAPTCHA, an automated test that humans can pass. " +
          "Access denied states in access-control research are also discussed. ".repeat(
            3,
          ),
      ),
    ).toBe(false);
  });
});
