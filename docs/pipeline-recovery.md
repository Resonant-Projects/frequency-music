# Pipeline recovery

Extraction Completion, Audio Publication, and Source Capture own their failure handling. A failure blocks only work that needs its result. Convex workflows schedule recovery; the agent worker performs investigations through the existing Agent Run queue. Temporal is not a dependency of this implementation.

## Extraction

`beginExtraction` saves the rendered user prompt, system prompt, prompt version, model, input hash, and Source identity before generation. A generation lease prevents simultaneous model calls for one attempt. Validated output is retained before the completion transaction creates Claims, links concepts, and changes Source status. Concept linking checks historical and archived state in the same transaction and does not increment existing source-concept links again.

Completion checks whether the snapshot still owns the Source's current reading. A late result becomes historical with superseded Claims. It cannot replace newer Claims or undo an archive. Readers that select current evidence exclude historical Extractions. The source Extraction query returns current rows by default; `includeHistorical: true` explicitly includes retained history. Retrying completion uses the retained result without another model call.

New operator exports reserve snapshots and change the selected Sources to `extracting`. Copy `snapshotId` into results alongside `sourceId` and `inputHash`. Export first reloads unfinished operator snapshots that still own a live Source, including their exact per-item prompts, so an interruption before local files are written does not strand the work. Import uses the same completion transaction. Older exports without a snapshot retain the existing stale-text refusal. Pending operator snapshots expire after 24 hours, release admission back to `text_ready`, and remain available for late imports as history. A bounded cron normalizes legacy extraction history; global lists use current/legacy indexes with a fixed scan and result cap during the migration. An export is now a reversible write; do not treat it as a read-only inventory command.

## Audio

The shared publisher encodes 48 kHz, 16-bit mono WAV masters. If WAV exceeds 95,000,000 bytes, it losslessly compresses that PCM to FLAC without resampling. An oversize FLAC fails before minting an upload URL. MP3 delivery remains 48 kHz. Only delivery artifacts can enter the feed.

Workers keep successful speech chunks and completed job results under `MEDIA_WORK_DIR/retained`. Chunks include a checksum and a key derived from the text, full voice settings, renderer version, and job input. Atomic metadata publication prevents a partially written chunk from becoming a cache hit. A separate synthesis-intent record distinguishes an unstarted chunk from a lost acknowledged checkpoint or an interrupted call. Lost or corrupt metadata requires review; only a confirmed failed synthesis call can start again. Scratch directories remain separate per lease attempt. Repeated upload admission reuses an artifact belonging to the same job and content hash; attached blobs are not uploaded again. A completion retry uses the persisted result. The sweeper preserves pending artifacts while their job or recovery remains active, including review, and advances its scan past retained records. It saves the scan cutoff with its cursor so later sweeps reuse the same query.

Mount `MEDIA_WORK_DIR` on persistent storage before enabling recovery. The production compose definition belongs to `homelab-infra/hosts/frequency-media`, outside this repository. Keep the same retained volume when restarting or replacing its worker. A retry with a missing job checkpoint, or a corrupt retained chunk, stops for review instead of repeating paid synthesis. This also means jobs created before these checkpoints existed may need operator recovery.

After acknowledged job completion, the runner removes its retained directory. Failed or ambiguous completion keeps all checkpoints for retry. Monitor disk space for failed jobs and remove their directories only after the job is terminal and no recovery remains. Disk write errors are reported as job failures. Operator essay publication keeps its checkpoints in its batch publisher directory. It defers only its own queued failed job before continuing other essays; a claimed or unrelated queued job still prevents unsafe claims.

## Investigation and recovery

An Operational Failure has a stable operation identity and a server-derived target. Delivery retries do not create duplicate failures. The audit outbox preserves terminally rejected records under `dead-letter/` and removes them from active delivery capacity. Network errors, server failures, timeouts, and rate limits remain retryable. Capture retains the intake payload; extraction retains the attempt ID; media retains its job ID.

Capture and extraction receive two bounded retries before investigation. The extraction workflow does not add another retry loop; repeated admission reuses the same failed attempt. Media jobs have already exhausted their normal retries, so their recovery starts with investigation. Failures with the same cause share a queued investigation, up to 20 failures per run. An indexed slot count finds groups with capacity; membership freezes when the run starts. One structured model call receives redacted errors, current prerequisites, and retained-output availability. Evidence retrieval, diagnosis, and submission share a two-minute deadline; model output is limited to 4,096 tokens with no provider retries. Capture recovery reads and completion requests, audit delivery, and terminal completion calls have 30-second transport deadlines. A failed investigator goes to review without spawning another investigator.

The model can recommend another retry and provide a diagnosis. It cannot choose identifiers, execute commands, edit code, change credentials, publish research, or raise a cap. Server code performs only capture intake, extraction resumption, or requeueing an unleased media job. Recovery allows at most three attempts. An attempt number fences workflow completion and dispatch; capture completion also checks the assigned Agent Run. Exhausted or unsupported recovery remains visible as `needsReview`.

The five-minute reconcilers catch interrupted extraction attempts, workflows, and terminal workers. Active recovery records move their next check forward so they cannot hide later terminal records. Discovery has queue preference, but an investigation waiting five minutes becomes eligible in normal oldest-first order. A bounded investigation may occupy the worker's single slot for up to two minutes; it cannot hold the queue indefinitely.

The Agent Run page shows failure state, diagnosis, attempt count, and recovery outcome. These records require authentication. Unrelated work remains runnable when a record needs review.

## Audit delivery

Agent audit events have stable delivery IDs. Failed audit writes and capture-failure reports enter a disk outbox; replay is idempotent. `AGENT_OUTBOX_DIR` defaults to the worker user's local state directory. The included agent compose file mounts `/data/outbox` persistently. Kubernetes deployments must mount an equivalent persistent volume and set that variable.

The outbox holds at most 2,000 directory entries, with 256 KB per record. Each poll attempts at most five deliveries with a two-second timeout each before continuing ordinary claims. Batches rotate past failed records so one rejected batch cannot starve later reports. Credentials used for HTTP transport are never in the spool. Errors are redacted; retained capture text is private research data, so preserve directory permissions and do not publish the volume. Capacity and filesystem failures are logged. Inspect and repair unavailable storage rather than deleting unresolved failure reports.

## Activation and validation

No live deployment is part of these changes. Deploy the Convex schema/functions and compatible workers together after checking the target. Provision persistent worker storage first. Do not run `convex dev`, `codegen`, `run`, or `deploy` as a local verification shortcut.

Focused tests cover stale extraction completion, archive preservation, retry caps, recovery ownership, outbox restart, FLAC PCM equivalence, cap refusal, retained synthesis, and completion retry. Run `vp run verify` before release. End-to-end production recovery still requires a separately authorized deployment and controlled failure exercise.
