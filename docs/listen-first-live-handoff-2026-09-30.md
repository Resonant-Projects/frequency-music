# Listen-first live handoff

Updated September 30, 2026. Wave 1 implementation is deployed. The expanded production shootout contains five blind takes in a 6-minute-58-second episode, including male and female voices. Human listening acceptance remains separate from deployment. The private feed and public audio downloads, including seeking, are verified.

## Keith's steps

1. Open [Listen](https://app.resonantprojects.art/listen) and sign in with your usual Frequency account.
2. In **Podcast feed**, select **Copy address**. The full private URL is also selectable if clipboard access is unavailable.
3. In Pocket Casts, open **Discover**, paste that entire address into search, open the result, and select **Subscribe**. The feed is named **Frequency Music, private**. If already subscribed, refresh it; the address has not changed.
4. Play the newest **Voice shootout**, lasting about 6:58. The earlier 2:46 comparison remains in the feed. Individual blind takes are also available on the website.
5. Rate every new take from 0 to 5 for naturalness, prosody, clean audio, clarity, and overall quality. Notes are optional. For clean audio, 5 means no artifacts.
6. After every take is rated, the website reveals the voices. Select **Set as house voice** on your preferred voice. The system does not infer that choice from scores.
7. Your first explicit choice starts narration of recent briefs. Refresh Pocket Casts after processing finishes to find **Weekly turn, week of ...**. New briefs use your selected voice automatically; Saturday reconciliation catches missed briefs.

The subscription address includes a private feed token. Retrieve it from the signed-in page rather than a committed document. The feed contains the shootout before a house voice is selected.

## Available voices and account actions

The expanded comparison contains Gemini, Inworld, Breeze, and two Cartesia candidates: Nandi and Quentin. The Cartesia pair provides female and male voices. Candidate names are not mapped to blind take labels here. The existing Cartesia credential is connected; both candidates rendered successfully through the production pipeline.

Gemini's daily free quota became available again, and its take completed. For ongoing use, enable billing on the same Google AI Studio project as the saved key. ElevenLabs remains explicitly omitted because the Frequency API key has a custom 1,000-credit cap, with 101 credits remaining while one calibration paragraph requires 417. Raise that key cap first. If account credits are also exhausted, use ElevenLabs Pay As You Go top-up. The account's subscription tier could not be read with the saved key.

[Voice provider setup](voice-provider-setup.md) contains the exact Gemini and ElevenLabs billing steps, current minimum top-ups, provider links, and deployment instructions. No billing plan, payment, or key quota was changed by this work.

## Acceptance still requiring Keith

- Listen to the expanded comparison, submit ratings, and choose the house voice.
- Confirm Pocket Casts subscription, playback, and seeking on your device.
- Listen to the first weekly episode after selecting the voice and assess its quality.

The previous group and its ratings remain intact. The new group is unrevealed and the house voice is unset as of this verification. Agents did not submit ratings or select a voice.

Keep local TTS available until the voice choice is known. If a hosted voice wins, the operator can stop `tts-local` and clear `BREEZE_TTS_BASE_URL` during subsequent host cleanup. Do not stop it while a job needs it.

## Wave 2

[The docket and signed decisions plan](superpowers/plans/2026-09-30-listen-first-wave-2-docket-and-decisions.md) is ready for implementation. Start with the text docket and shared decision contracts. Spoken cards depend on the chosen house voice. Verify that voice's actual OpenClaw provider support, including Cartesia if selected; a catalog mapping is not proof that the external integration exists.

Platform decisions require separate signer bots and verified mappings to your account. The plan lists code tasks, tests, external prerequisites, staged deployment, and human acceptance. Wave 2 is not deployed by this handoff.

## Operator evidence

Claude Opus 5.5 implemented the application and infrastructure changes. GPT-6.1 Sol workers checked operations and reviewed each substantive candidate through the required isolated review workflow.

- Application [PR #87](https://github.com/Resonant-Projects/frequency-music/pull/87) merged as `bc4332900a61d442133af79ef1e313d59ed158c1`. `vp run verify` passed all 956 tests, formatting, lint, and typechecks. Independent review completed with no findings. GitHub CI and image scans passed.
- Both Convex and the media worker use renderer `0.2.2`. The full queue was idle before stopping the old worker and after deploying the backend. Deployment targeted the existing self-hosted backend at `http://172.16.10.24:3210`, with no schema or index removal. Root checks cover Convex; deployment used `--typecheck disable --codegen disable` because there is no separate `convex/tsconfig.json`.
- Media started on `ai-5090-02` at 14:46:32 UTC from the same application SHA. Image digest is `sha256:c704e13dc92157d82ee6861d20f12870986d4aee91713267d0c3c6a0f672eb5c`. Gemini, Inworld, and Cartesia keys are present; ElevenLabs is explicitly empty. Breeze retained its existing container and start time, and returned HTTP 200 from inside the media container.
- Credential deployment [homelab-infra #599](https://github.com/keithce/homelab-infra/pull/599) merged as `858ff6f2b7fe5d051a8490e7a946d82571e84203`. Reviewed compose and deployment files were installed exactly. Only `MEDIA_IMAGE_TAG` changed in the host's existing `.env`; all other bytes were preserved. The media-only update preserved local TTS.
- GitHub production deployment `6762165438` succeeded for the merged application SHA. The live site requires the usual Clerk sign-in. Authenticated rendering, clipboard behavior, and Pocket Casts playback remain human acceptance checks.
- New shootout job `nd77e8r8d4ghnk3e7pw1nxd7898fdb23` completed on its first attempt. Group `n977jy0k06mncwecfd1d95r8zx8fdbj9` has five members and is unrevealed. All 12 artifacts are ready, measure −16.0 LUFS, and have a highest true peak of −1.3 dBTP.
- Episode `n575dqk0hsh78xtthtm2spyh998fcqjv` is a 417.552-second, 6,681,216-byte MP3. The previous two-voice episode remains available. Earlier failed jobs remain as provenance.

## Durable podcast routing correction

The earlier handoff incorrectly described the Listen Nginx Proxy Manager host as unmanaged. Current infrastructure source declares it in `services/convex-hatchet/service.json`. An automatic deployment at 02:06 UTC removed the earlier API-only custom location, making public audio downloads return 404 again.

[homelab-infra #601](https://github.com/keithce/homelab-infra/pull/601), merged as `777c0570a4d868eb24cb326930bb97068bbc97cf`, moves the fix into the managed route's `advanced_config`. Storage paths use port 3210; podcast paths remain on port 3211. The URI allowlist, TLS, certificate, access, and cache settings remain unchanged. The location suppresses suffix-only Range requests upstream because Convex otherwise returns an invalid underflowed range; full-file HTTP 200 is the valid fallback. Other ranges retain normal HTTP 206 behavior.

Fourteen focused static tests and 12 real nginx tests passed, as did the isolated review and infrastructure CI. [Managed deployment run 36732636609](https://github.com/keithce/homelab-infra/actions/runs/36732636609) succeeded for the merged source. The private RSS returned HTTP 200 with valid XML and two items; a wrong token returned 404. The new public enclosure returned the full 6,681,216-byte MP3 with HTTP 200. Prefix, midfile, and open-ended Range requests returned HTTP 206 with the exact expected bytes and Content-Range values. A suffix-only request returned HTTP 200 with the identical full body and no Content-Range. The downloaded file is MP3, 48 kHz, two channels, 128 kbps. These checks establish server delivery; actual Pocket Casts playback remains Keith's check.

For future media deployments, preserve an explicitly empty `ELEVENLABS_API_KEY` until its allowance is usable. Omitted optional variables resolve from 1Password, so an ordinary deployment would restore that blocked provider. Gemini and Cartesia should remain enabled.
