# Listen-first live handoff

## October 5 listening decision and full-episode trials

Keith prefers Voxtral's male preset and ElevenLabs' male directed delivery
at both tested lengths. He reported no strong preference between ElevenLabs
v3 and v4, with v4 slightly cleaner. Use v4 for the next full episode without
recording a stronger ranking or inventing numerical ratings.

The live `houseVoiceId` was verified as `inworld-max` on October 5. Its
catalog voice is Dennis, using `inworld-tts-1.5-max`. Preserve this regular
voice. The private feed returned HTTP 200 and already contained weekly
episodes for September 14, September 21, and September 28, lasting 9:46,
9:05, and 11:00 respectively.

Keith requested three different complete episodes, one per preferred voice,
for sustained listening in the car, on headphones, and on a laptop. These
are personal listening trials with different topics. Do not render one
script in all three voices. Use hosted subscriptions before November 2,
2026. The prepared audio editions are:

| Essay | Voice | Status |
| --- | --- | --- |
| Three weekly turns, September 14 to 28 | Inworld Max, Dennis | Published, 29:51; a compilation of three existing, verified Inworld narration masters. |
| The arrow of sound | Voxtral male preset | Published, 16:53; temporary RTX 3090 service removed. |
| The listening gap | ElevenLabs v4, George, directed | Published, 16:08. |
| The tuning codec | Inworld Max, Dennis | Published, 14:47 after Keith restored credits; download, decoding, playback and seeking verified. |

The three newly synthesized scripts adapt existing repository essays for
speech and include spoken introductions and closing feedback prompts.
Inworld returned HTTP 402 on the first new synthesis request. Its listening
trial initially combined the existing weekly narration masters for September
14, 21, and 28, each verified as `inworld-max`, with chapter breaks and
original artifact IDs recorded as provenance. This creates a new continuous
episode without new Inworld synthesis or a billing change. The original
prepared Inworld essay, "The tuning codec", was initially deferred. Keith
subsequently restored credits, and the fresh essay was rendered and published.
Source hashes, script
snapshots, attempted-character ledgers, render settings, and operational
evidence are retained in the ignored `out/wave2-listening-20261005/`
directory in the October 5 worktree. They are essay audio editions, not new
weekly briefs or newly verified research findings.

The ElevenLabs live model catalog confirmed `eleven_v4` supports TTS. Its
directed settings use George, `stability: 1`, `similarity_boost: 0.75`, and
`speed: 0.95`. Voxtral uses `mistralai/Voxtral-4B-TTS-2603`,
`neutral_male`, and seed 42. No additional Voxtral style control is invented.
Paid rendering counts attempted characters, including failures, against an
18,000-character cap per provider for this batch, with no automatic paid
retries. No payment or subscription change is part of the operator work.

Publication uses the existing leased narration and episode lifecycle, with
accurate voice and source provenance on `audioArtifacts`. The regular media
worker is stopped only after a complete queue scan confirms no queued or
claimed work, then restored after the bounded publication step. The
operator renderer is identified separately from production renderer 0.2.2.
Upload admission still enforces the 95 MB cap; private PCM masters preserve
the provider's native 24 kHz when a 48 kHz master would exceed that cap.
Deliveries remain 48 kHz, stereo, 128 kbps MP3. No storage ownership, house
voice, human ratings, or research decisions change.

Wave 2's docket and signed-decision implementation remains pending. The
house-voice prerequisite is now satisfied; exact OpenClaw compatibility and
the separate platform signer integrations still require verification. The
episode trials can proceed through the deployed Wave 1 pipeline.

### Verified October 5 delivery

Refresh the existing private feed in Pocket Casts to find all three episodes.
For a new subscription, retrieve the address from the signed-in
[Listen page](https://app.resonantprojects.art/listen). The feed token and
address are unchanged. The three trials total 62:52 of listening.

| Voice | Ready episode artifact | Delivery bytes |
| --- | --- | --- |
| Inworld Max | `n579ms46y1eb3czj4aw4cm4mad8fqfxb` | 28,659,840 |
| Voxtral male preset | `n5746p9y8we1m4k5yw3b1mhe9s8fp2vy` | 16,205,184 |
| ElevenLabs male directed v4 | `n57cn7e1fp9bg8yqfe3t3xqvss8fq3c5` | 15,481,728 |

All six new media jobs completed on their first attempt. The final queue
scan found 15 done jobs and the same three pre-existing parked jobs, with no
queued or claimed work. `houseVoiceId` remains `inworld-max`. The regular
media worker was restored after each publication, and the temporary Voxtral
pod was deleted. The RTX 3090 returned to 80 MiB of memory use.

Every new enclosure downloaded with HTTP 200 and the exact feed byte count.
All three MP3s decoded completely and have no embedded metadata. Prefix,
midfile, and open-ended seeking returned HTTP 206 with matching bytes and
Content-Range. Suffix-only requests returned the existing valid full-body
HTTP 200 fallback. The T3 collaborative browser loaded all three, sought
into the middle of each, and advanced playback with sound muted and no
media errors. Playback on Keith's devices and subjective fatigue remain
his listening checks.

All masters and deliveries measured -16.0 LUFS. The highest measured master
true peak was -1.3 dBTP; deliveries ranged from -3.9 to -4.6 dBTP. Inworld
and Voxtral masters use native 24 kHz PCM to fit the existing cap; ElevenLabs
masters use 48 kHz PCM. The largest upload was 92,885,804 bytes.

ElevenLabs used 14,144 attempted characters for the new episode. Voxtral
used 13,406 local characters. The Inworld compilation required no new
synthesis; its initial blocked essay request is retained in the attempt
ledger. This initial delivery preceded the fresh Inworld recording described
below.

`vp run verify` passed formatting, lint, all package typechecks, and all
1,064 tests. No backend deployment, permanent worker update, catalog
replacement, platform messages, signer actions, or research publication
was needed. The only tracked repository changes are this handoff and the
Wave 2 plan's updated voice prerequisite.

Keith recovered the original Mac Pro evaluation evidence into
`out/macpro-voxtral-handoff-20261005/`. Its report confirms the ElevenLabs
directed settings used here: George, `eleven_v4`, stability 1.0, similarity
0.75, and speed 0.95. The recovered `scripts/local.py` confirms Voxtral's
model, `neutral_male`, seed 42, and vLLM Omni 0.30.0. Port 8792 belonged to
the static listening room; the original synthesis server used internal
port 8091 in a temporary pod, and its evaluation namespace was deleted.
The October 5 renderer was a separate temporary service, also removed
after use. The recovered report and generation evidence match the intended
voice presets; no replacement render was needed.

### Inworld credit restoration and fresh episode

Keith added Inworld credits after the initial three-episode delivery. The
production key then successfully resumed synthesis of the prepared
2,242-word essay "The tuning codec", using `inworld-tts-1.5-max` and Dennis.
It has a different topic from the Voxtral and ElevenLabs essays. The
earlier weekly-turn compilation remains available as additional listening.

The resumed recording's independent snapshots, generation ledger and
verification evidence are in ignored
`out/wave2-listening-inworld-20261005/`. Its ledger retains the original
failed request from the first batch and enforces the same 18,000 attempted
character limit. All 49 paragraphs completed successfully: 14,564 synthesized
characters, with 14,814 attempted characters including the original failed
250-character request. No further paid retries were needed.

The fresh episode is ready as artifact `n576n7wva5tcdacxxbwe07y9858fq8gy`,
duration 887.06 seconds (14:47), with a 14,193,792-byte delivery. Both new jobs
completed on their first attempt. Its 48 kHz mono PCM masters remain below
the 95 MB upload cap; delivery is 48 kHz stereo, 128 kbps MP3. Masters and
deliveries measure -16.0 LUFS, with episode true peaks of -1.8 dBTP for the
master and -4.6 dBTP for delivery.

The feed returned HTTP 200 and contains the fresh episode. Its enclosure
download matched the exact byte count, decoded completely, and has no
embedded metadata. Prefix, midfile and open-ended requests returned HTTP
206 with matching bytes and Content-Range; the suffix-only request returned
the identical full-body HTTP 200 fallback. The T3 collaborative browser
advanced muted playback after seeking to 440 and 840 seconds, with no media
errors. Keith's device playback and subjective fatigue checks remain his.

The regular media worker is running again. The final queue scan found
17 done jobs and the same three pre-existing parked jobs, with no queued or
claimed work. House voice remains `inworld-max`; the private feed address
and token are unchanged. Refresh the existing subscription in Pocket Casts.
The three fresh essays total 47:47; the earlier 29:51 compilation remains
available. `vp run verify` passed again during this credit-restoration work,
including all 1,064 tests, formatting, lint and package typechecks.

### Website episode list

On October 5, the production Listen page was updated to show the published
RSS episodes newest first, with dates, readable durations and native audio
controls. It obtains the feed address from the existing authenticated
subscription query, then reads RSS through the same-origin website rewrite.
No Convex deployment or new backend query is required. Refresh runs every
minute while visible, on returning to the page, and through the manual
Refresh episodes button. Unchanged players survive refresh without interrupting
playback; failed refreshes retain the previous list and offer retry.

Vercel deployment `frequency-music-29t1lgyfx-rproj.vercel.app` is ready and
aliased to `app.resonantprojects.art`. The live website RSS proxy returned
HTTP 200, `application/rss+xml`, and `cache-control: no-store`; its XML
matched the original RSS exactly and contained nine items. An invalid feed
token returned 404. The live Listen JavaScript contains the new episode
controls. Local browser checks used captured live RSS and the actual route
component with a test subscription address, checking desktop and phone
layouts, seeking/playback, refresh continuity, malformed-feed rejection,
empty/error states and recovery. The production authenticated page still
requires Keith's sign-in; the browser session here is signed out.

The web build and `vp run verify` passed, including 1,064 tests. Sanitized
release evidence is in ignored `out/listen-rss-production-verification.json`;
local browser harness and feed snapshot are in ignored
`web/out/listen-rss-preview/`. The deployed source was an isolated tracked
checkout with the reviewed web changes, excluding operator evidence and
local environment files. [Web deployment notes](reference/vercel-web-deploy.md)
document the proxy and the current `rproj/frequency-music` project owner.

## September 30 deployment evidence

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
