# Voice provider setup

Checked September 30, 2026. These steps expand the blind voice shootout without choosing a house voice or changing existing ratings. Retrieve credentials through 1Password; do not put their values in this document or chat.

## Gemini

The earlier failure was the project's free-tier daily request limit, `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, capped at 10 requests for the configured TTS model. Google applies limits per project, not per API key. Daily quotas reset at midnight Pacific time.

1. Open [Google AI Studio API Keys](https://aistudio.google.com/api-keys) or [Projects](https://aistudio.google.com/projects).
2. Find the project that owns the existing Frequency Gemini key. Under **Billing Tier**, choose **Set up billing** and attach an active Google Cloud billing account with a payment method.
3. Complete whichever payment setup the account offers. Some projects require **Set up Prepay** or show **No credits**. If prompted, use [Billing](https://aistudio.google.com/billing) → **Buy credits**; the documented minimum prepayment is $5. Other accounts may offer Postpay.
4. Confirm the project shows **Paid Tier 1** and check the model's [active rate limits](https://aistudio.google.com/rate-limit). Preview models still have limits on paid projects.

The existing key can stay. Creating another key in the same project does not provide a separate quota. The media worker must also have `GEMINI_API_KEY` restored after its temporary omission; changing billing alone does not modify the running container.

At the documented standard rate for `gemini-3.1-flash-tts-preview`, generated audio costs about $0.03 per minute, plus text input: $20 per million audio output tokens at 25 tokens per second, and $1 per million text input tokens. Check current pricing before setting an ongoing usage budget.

Sources: [billing setup](https://ai.google.dev/gemini-api/docs/billing?hl=en#setup-billing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## ElevenLabs

There are separate account-credit and API-key limits. The earlier failed request named the **Frequency key's custom allowance**: a 1,000-credit cap, with 101 credits remaining while one paragraph required 417. That error alone does not establish whether the account uses a free or paid plan. The saved key cannot read subscription metadata, so the account tier has not been verified through it.

1. Open [API Keys](https://elevenlabs.io/app/settings/api-keys), or **Developers → API Keys**. Find **Frequency**, open **… → Edit**, and raise its custom credit limit enough for the planned use. A bounded 10,000-credit test allowance leaves room for a complete calibration passage and retries; it is not a required subscription size.
2. If account credits are also exhausted, open [Developers](https://elevenlabs.io/app/developers) → **Top Up**. Current Pay As You Go top-ups are available on all self-serve tiers, including Free. The documented minimum is $5 USD or ₹500 INR. Add or confirm a payment method and complete the top-up.
3. Subscription credits are used before Pay As You Go credits. Buying credits does not remove a lower custom key limit; check both.
4. If this is an eligible **legacy** subscription, [Subscription](https://elevenlabs.io/app/subscription) → **Manage Subscription** may instead expose **Usage based billing**. Set a finite additional-credit limit and confirm. New self-serve subscriptions use Pay As You Go instead; do not expect that legacy toggle on every account.

The existing key can stay unless it is deliberately replaced. Restore `ELEVENLABS_API_KEY` in the worker after the allowance is usable; it was temporarily omitted to prevent an entire shootout from failing.

Sources: [API key creation and editing](https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key), [Pay As You Go](https://elevenlabs.io/docs/overview/administration/pay-as-you-go), [usage-based billing](https://elevenlabs.io/docs/overview/administration/usage-based-billing).

## Cartesia

The existing credential is `op://Homelab Runtime/Cartesia API Key/credential`. The integration uses `CARTESIA_API_KEY` in the media container. Missing or explicitly empty provider keys are skipped by shootouts.

The selected pair is **Nandi**, a female voice suited to documentary and informational narration, and **Quentin**, a male voice described as a refined narrator. Their voice IDs were verified against the live catalog. The provider targets the stable `sonic-3.6-2026-08-27` snapshot and API version `2026-08-14`. Both voices passed short live synthesis checks on September 30 using the pinned model and API version. The shootout uses the same calibration passage and loudness policy as the other candidates.

A standard Cartesia API key is required for TTS. Admin keys and standard keys are not interchangeable. Check credit capacity at [Subscription](https://play.cartesia.ai/subscription) and activity at [Usage](https://play.cartesia.ai/usage). Cartesia documents approximately one credit per character and charges successful requests; its subscription overages setting controls whether usage can continue beyond the included allowance. No subscription or billing change is made by connecting the saved key.

Sources: [models and snapshots](https://docs.cartesia.ai/build-with-cartesia/tts-models), [audio bytes API](https://docs.cartesia.ai/api-reference/tts/bytes), [voice library](https://play.cartesia.ai/voices).

## Operational sequence

1. Verify provider capacity with bounded requests before a full shootout. A working short sample does not prove enough credits remain for the whole passage.
2. Deploy the matching backend and media renderer while no media job is active. Preserve local TTS and the working private feed.
3. Resolve usable keys through the existing deployment script. Preserve explicit empty overrides for providers whose quota remains blocked.
4. Enqueue a new shootout with `rerun: true`. Keep prior groups and ratings. Verify the new job, blind group, episode, RSS, and audio delivery before handoff.
5. Rate the new takes on [Listen](https://app.resonantprojects.art/listen). House-voice selection remains an explicit human action.
