# Signed-in production page check, 2026-10-22

Keith signed in through Clerk in the fresh guarded Chrome for Testing profile
on ubudesk. The expected redirect returned to
`https://app.resonantprojects.art/listen`. GPT-6.1 Sol inspected its real
content, then ran the prepared `signin/resume-probe.sh` from the operator
folder at 21:16 UTC. It closed and reopened the same profile on ubudesk's
headed Xwayland `:0` desktop; authentication survived that restart. No
cookies or authentication state were copied to another host.

| Route | Desktop 1440×900 | Mobile 390×844 | Observed content |
| --- | --- | --- | --- |
| `/listen` | HTTP 200, signed in | HTTP 200, signed in | Real episode rating cards and episode list; studio comparisons and upload form |
| `/docket` | HTTP 200, signed in | HTTP 200, signed in | Three drafts awaiting review, plus composition material |
| `/feedback` | HTTP 200, signed in | HTTP 200, signed in | Feedback & Listening Sessions form and recent-feedback section |
| `/failures` | HTTP 200, signed in | HTTP 200, signed in | Failure Archive, reason/thesis filters and a valid empty archive state |

The parent inspected headings, content and desktop/mobile screenshots, not
only the probe's hostname-based `signedIn` flag. A follow-up live DOM read
confirmed the studio section says “No studio comparisons yet” and the upload
form says “No machine render is waiting for comparison”. This verifies the
live empty state; it does not verify a populated comparison or a completed
upload/rating/reveal flow. The offline listening packet has not been uploaded.

## Scope and guards

The probe only navigated and captured screenshots. Guards installed before
navigation dropped outgoing Convex Mutation/Action WebSocket messages and
aborted non-GET requests to the application and Convex hosts. Clerk sign-in
traffic was allowed. No app writes were attempted and no blocked-write event
was logged. Ratings, uploads, publication and audio playback were not tested;
no renderer validation or production setting changed.

The same profile was reopened on `/listen` and left available under the
same guards after the probe. It is suitable for read-only browsing; write
controls in this guarded session cannot complete.

## Private operator evidence

Full screenshots and `probe-results.json` remain on ubudesk under
`~/.local/state/frequency-parallel/20261022/artifacts/web-studio/signed-in-20261022T211616Z/`.
The folder is mode 0700 because full-page captures can display private-feed
material. Cropped page overviews and a result-file copy were inspected on
devbox under `artifacts/parent/signed-in-20261022T211616Z/` in the same operator
folder. Browser profile and private-feed URLs are not included in this record.
