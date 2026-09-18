# Frequency native pause recovery controller

`native-pause-controller.py` implements only the temporary backend pause and
resume portion of the reviewed worker handoff. It never stops a worker, deploys
source, reads queue rows, or changes job status. Root on CT113 with the verified
hostname `convex-hatchet` is required. The backend endpoint is fixed to
`http://127.0.0.1:3210`; redirects and environment proxies are disabled.

Install the reviewed script at a stable root-owned path inside CT113 before the
maintenance window. Keep it there until the watchdog has finished. Only one
coordinator may operate native pause during this window. Confirm source worker
identity, lifecycle balance, lack of external children and absence of a
replacement worker before beginning. Avoid the recorded daily 05:00/06:00 UTC
and Wednesday/Thursday 16:00 UTC cron windows. Pausing rejects application
functions, queues scheduled jobs and skips cron occurrences within the window.
It does not cancel previously started external effects.

## Commands and ownership

```sh
python3 /root/native-pause-controller.py begin
python3 /root/native-pause-controller.py resume
```

`begin` creates `/run/frequency-native-pause` with mode 0700 and derives the
existing admin key using `docker exec app-convex-backend-1
./generate_admin_key.sh`. The key remains in a mode-0600 local file. It does not
appear in command arguments, output or systemd unit configuration.

Before making any pause request, the controller starts and checks the local
`frequency-native-pause-resume.timer`. It fires 120 seconds after arming, with
one-second timer accuracy, and starts a recovery service with a 30-second
execution budget. The timer survives SSH disconnects and controller exits; it
does not survive a CT113 reboot. This is a recovery attempt deadline, not a
promise that an unavailable backend will recover within 120 seconds.

The controller requires an authenticated `running` state before persisting
ownership and sending pause. A preexisting paused, disabled or suspended state
is refused without sending an unpause. A successful `begin` requires HTTP 200
and a subsequent authenticated `paused` state. Ownership is saved before the
pause request so a lost HTTP acknowledgement still triggers recovery.

Each controller invocation has a hard 28-second process deadline. On signal or
deadline it exits directly, releases its lock and leaves the independent timer
responsible for recovery. Ordinary errors during pause attempt immediate
resume. Recovery checks state, sends unpause only if currently paused and
requires authenticated `running` readback. A lost unpause response can therefore
be resolved by readback. Disabled or suspended states are never overridden.

If pause acknowledgement was lost, immediate successful recovery retains the
watchdog, key and ownership for another recovery attempt at the timer deadline.
That case returns failure rather than permission to continue the handoff. The
watchdog retries failures within its service budget and waits for the controller
lock within the same hard deadline. Successful normal recovery disarms the
timer only after running readback; watchdog recovery does not stop itself.

## Failure handling and worker handoff

Ordinary failures print only a fixed error code. A signal or hard deadline exits
without writing, so a disconnected or blocked SSH output cannot prevent exit. Do not start a replacement
worker. Retain the private run directory and inspect the recovery service's
sanitized result. If recovery fails, the key and owned state remain for an
explicit `resume` retry; failure is an incident, not a completed handoff.

After a successful pause, the external coordinator must run the separately
reviewed bounded queue collector and require no running rows, verify the source
lifecycle has no active graph/child and then perform the separately bounded
worker stop with Docker's forced kill disabled. Resume immediately on any failed
condition and after the verified stop. These operations are outside this
controller. Successful pause output explicitly does not authorize worker stop.
A timer firing before the stop completes invalidates the admission barrier;
start no replacement and re-evaluate actual source state.

The run directory and lock deliberately prevent a second `begin`. After verified
recovery and completion of the watchdog, retain sanitized evidence and archive
the no-longer-secret run record before another maintenance attempt. Never remove
an owned record, its key or an active recovery timer merely to retry `begin`.

## Tests and limits

```sh
python3 scripts/recovery/tests/test-native-pause-controller.py
```

The tests cover ownership ordering, preexisting-state refusal, timer failure,
lost pause/resume acknowledgements, failed immediate recovery, watchdog recovery
without a coordinator, disabled/suspended protection and retained failure
evidence. Real subprocess tests verify the hard deadline cannot be swallowed
and the watchdog waits through lock contention. They do not contact a backend
or install a real systemd timer. Production state transitions and timer behavior
still require their own sanitized execution receipt.
