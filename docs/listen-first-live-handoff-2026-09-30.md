# Listen-first live handoff

Date: September 30, 2026. Wave 1 implementation is merged and deployed. The two-voice production shootout and private feed are ready. Human listening acceptance remains separate from deployment.

## Keith's steps

1. Open [Listen](https://app.resonantprojects.art/listen) and sign in with your usual Frequency account.
2. In **Podcast feed**, select **Copy address**. The full private URL is also selectable if clipboard access is unavailable.
3. In Pocket Casts, open **Discover**, paste that entire address into search, open the result, and select **Subscribe**. The feed is named **Frequency Music, private**.
4. Play **Voice shootout**. You can also play the individual blind takes on the website. Rate every take from 0 to 5 for naturalness, prosody, clean audio, clarity, and overall quality; notes are optional. For clean audio, 5 means no artifacts.
5. After every take is rated, the website reveals the voices. Select **Set as house voice** on your preferred voice. The choice is yours; the system does not infer it from scores.
6. Your first explicit choice starts narration of recent briefs. Refresh Pocket Casts after processing finishes to find **Weekly turn, week of ...**. New briefs use your selected voice automatically; the Saturday reconciliation catches missed briefs.

The subscription address includes a private feed token. Retrieve it from the signed-in page rather than a committed document. The feed contains the shootout before a house voice is selected, so subscribing does not depend on choosing a winner first.

## Acceptance still requiring Keith

- Listen to the actual shootout, submit your ratings, and choose the house voice.
- Confirm Pocket Casts subscription, playback, and seeking on your device.
- Listen to the first weekly episode after selecting the voice and assess its quality.

Keep the local TTS service available until the voice choice is known. If a hosted voice wins, the operator can stop `tts-local` and clear `BREEZE_TTS_BASE_URL` during the subsequent host cleanup. Do not stop it before the shootout or while a job needs it.

## Wave 2

The next implementation is [the docket and signed decisions plan](superpowers/plans/2026-09-30-listen-first-wave-2-docket-and-decisions.md). Text cards can proceed independently of the voice choice. Spoken cards require the chosen voice. Platform decisions require separate signer bots and verified mappings to your account; agents only propose decisions.

The plan lists concrete code tasks, tests, external prerequisites, staged deployment, and human acceptance. Wave 2 is prepared for implementation; it is not deployed by this handoff.

## Operator evidence

- Implementation PR [#81](https://github.com/Resonant-Projects/frequency-music/pull/81) merged as `797339c6d25473f50f0bfa5213bf4a867332d91a`. Claude Opus 5.5 implemented the handoff and audio fix; GPT-6.1 Sol workers reviewed code and checked deployment and Wave 2 prerequisites.
- Convex deployment succeeded against the existing self-hosted backend. Root TypeScript checks passed; deployment used `--typecheck disable --codegen disable` because this repository checks Convex through its root project and has no `convex/tsconfig.json`.
- Media renderer `0.2.1` started on `ai-5090-02` at 01:35:07 UTC from the same source SHA. Image digest: `sha256:83203ae172d6879909196af0d09d67e4bbccce0d649b4fd95cb2d3dbdab7ea38`. All four job kinds are enabled. All hosted keys initially resolved, but Google and ElevenLabs were subsequently omitted from the worker runtime because of the account limits below. Breeze returned health 200 and was not restarted.
- Vercel production deployment `dpl_14aBa8w5E6TDRYXWLWFQ2fzru8d1` is READY and serves `app.resonantprojects.art`; GitHub deployment `6749318523` ties it to the merged SHA. The live Listen bundle contains the subscription controls and first-narration message. An unauthenticated browser visit reaches Clerk sign-in. Authenticated rendering and clipboard use remain part of Keith's acceptance.
- `vp run verify` passed all 940 tests: root 616, harness 91, agent 176, media 57, plus formatting, lint, and type checks. `vp run build` from `web/` succeeded. Root `vp run build:web` has a pre-existing Vite Plus task-resolution failure, `Task "build" not found`; the direct package build is the verified alternative.
- A real production speech recording exposed an old loudness failure. The fixed 16-bit master measured −16.1 LUFS / −1.4 dBTP; its MP3 measured −16.1 LUFS / −3.9 dBTP. The spoken policy remains −16 ±0.5 LUFS and peak ≤−1 dBTP. The old parked shootout is retained as failure provenance.

The full-catalog attempts exposed two account limits. Gemini returned `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, capped at 10 requests per day. ElevenLabs returned `quota_exceeded`: the Frequency API key has a 1,000-credit cap and only 101 credits remained, while one paragraph required 417. Its short probe succeeded, which confirmed the credential itself works. These providers are explicitly skipped for this shootout. Their credentials remain in 1Password; the omission is in the current worker environment only. An ordinary secret-resolving deployment restores them, so resolve the limits or preserve the omission before another shootout. Inworld and local Breeze remain available for rating and weekly narration.

The successful shootout job is `nd7assr5c5mv64jz34q1x84m9s8fdb06`, completed on its first attempt. Blind group `n97e2tsja1a8dsmt8cjavwbj9n8fcakq` has two members and remains unrevealed. All six artifacts are ready; their measured loudness is −16.0 LUFS and the highest true peak is −1.7 dBTP. No voice-to-take mapping is recorded here.

The feed contains **Voice shootout**, artifact `n57b235ycbtxegj072ckwdnw5d8fd51q`, lasting 165.864 seconds and containing 2,654,208 bytes. The downloaded delivery is MP3, 48 kHz, two channels, 128 kbps. RSS returns 200 with valid XML and one item; a wrong feed token returns 404. The authenticated subscription query returns the configured private address. The actual public enclosure returns 206 for `Range: bytes=0-99`, with `Content-Range: bytes 0-99/2654208` and exactly 100 bytes. This verifies the server support podcast clients need for seeking; actual Pocket Casts playback remains Keith's check.

The public download check caught a missing Nginx Proxy Manager custom location. Host 74 already forwarded podcast requests to the Convex site on port 3211 but was also forwarding storage requests there. The correction adds only `/api/storage/` to `http://172.16.10.24:3210`. The existing URI allowlist, root/podcast route, TLS, certificate, access and cache settings were preserved. NPM reports `nginx_online: true`. The configuration is persisted in NPM; no managed `listen.rproj.art` route was found in the inspected infrastructure source.

The deployment script fix is tracked in [homelab-infra #580](https://github.com/keithce/homelab-infra/pull/580). It resolves each service's image separately, skips local-image pulls, and supports a media-only update. Until quota capacity is restored, explicitly export empty `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` when using the updated script; omitted variables are resolved from the vault. Do not restart local TTS as part of a worker-only update.

No human ratings or house-voice choice are implied by these checks. The house voice remains unset, and the first weekly narration waits for Keith's explicit selection.
