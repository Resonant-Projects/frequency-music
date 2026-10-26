# Offline litmus renderer

`renderLocal(plan, { signal?, tempRoot?, run? })` validates an unknown input
through `expandRenderPlan`, then renders baseline and variants sequentially.
It returns `{ directory, artifacts, dispose }`; each artifact has `master`,
`delivery`, and `durationSecs`. Call `await dispose()` after consuming the
files. Failure or cancellation removes the entire working directory.

`buildScores(plan)` is the pure score inspection interface. Members retain
the shared frozen seed array. Notes loop at the maximum seed end, truncate at
the requested duration, and use `prepareDegreeToHz`. Admission limits come
from the shared contract, including 90 seconds and 8192 notes per member.
The renderer additionally rejects any seed fundamental above 5999 Hz in any
member, keeping all four partials strictly below 24 kHz Nyquist at 48 kHz.
It does not remove partials or modify the shared pitch contract.

Concurrent voices include the entire 300 ms release and two conservative
64-sample scheduling blocks. Scores exceeding 4096 concurrent voices fail
before execution. The scsynth node table is explicitly sized to the next
power of two at or above the voice count plus two: scsynth 3.13 NRT holds
n - 2 synths in an n-slot table (the root and default groups). Real-time
memory is explicitly 64 MB (`-m 65536`); each voice takes about 5 KB, and
the 8 MB default fails at 2048 voices. Block size is explicitly 64. The
512-note, 0.125-beat fixture at 120 BPM over 0.5 seconds schedules 4096
notes, peaks at 3072 concurrent voices including tails, and uses 4096 node
slots. SC error/failure diagnostics on either output stream
fail the render even when the process reports exit code zero.

The bundled `litmus.scd` defines four phase-reset sine partials, a linear
20 ms attack and 300 ms release, and fixed gain. Gates close at note ends;
release tails overlap subsequent notes and are cut at the study boundary.
Both stereo channels receive the same signal, with no widening. A 10 ms
score lead permits asynchronous SynthDef loading; encoding removes that lead.
The real-runtime smoke test must establish that the target SC build loads
this definition before the first note.

Execution requires `sclang`, `scsynth`, `ffmpeg` with libmp3lame, and `ffprobe`
on PATH. Each subprocess has a 60-second deadline and a 1 MiB output limit;
the whole family has a five-minute deadline. Processes use argument arrays,
no shell, no inherited secrets, and a private working HOME/TMPDIR. The real
adapter kills on abort and waits for close before file cleanup. An injected
`RunCommand` must honor the signal, deadline, and completion-before-return
contract. Injection is a trusted testing boundary, never plan data.

The music path emits 48 kHz stereo 24-bit WAV and 256 kbps MP3, strips input
metadata, rejects nonregular files and files above 95,000,000 bytes, verifies streams
and duration, and decodes outputs to detect corrupt audio. Normalization
uses linear gain to -18 LUFS and checks both master and decoded delivery
within 0.5 LU and at most -1 dBTP. It fails if linear gain cannot meet the
peak ceiling; no limiter changes the fixed timbre. `normalize:false` keeps
levels and skips loudness-target enforcement. Every trimmed float render is
measured with astats before fixed-point conversion. Both channel summaries
and the overall summary must contain explicit zero NaN and infinity sample
counts. Missing, malformed, duplicate, or nonzero counts fail the render,
even if the reported peak is finite. A `-inf` peak remains valid for genuine
silence when these counts are zero. This applies with normalization on or
off. With normalization off,
a sample peak at or above 0 dBFS is rejected without changing gain, since
positive full scale is not representable in signed 24-bit PCM. The zero
boundary also rejects peaks rounded to zero by the measurement. Missing or
invalid measurements fail closed. This check prevents silent clipping of
dense unnormalized chords; it is separate from the normalized music policy.

`renderLocal` itself produces private local working files with no uploads,
storage writes, evidence status, or gate mutation. The `litmusRender` media
job (`src/jobs/litmusRender.ts`) uploads them; Convex stamps validation at
completion (see `media/README.md`). File integrity checks do not establish
listening validity.

## Coverage

Host tests mock the SC subprocesses: deterministic scores, admission,
orchestration, deadlines, cancellation, output bounds, the 7040 Hz aliasing
example, the 6 kHz boundary, release-tail concurrency and node capacity,
zero-exit synthesis errors, and mocked float peaks for the 16-voice clipping
example. Four tests use the installed ffmpeg and ffprobe with generated float
WAV fixtures and mocked SC to reject NaN and infinite samples before 24-bit
conversion and to encode genuine silence. They skip without ffmpeg.

`tests/sc-real.test.ts` runs the real engine and requires `sclang`,
`scsynth`, `ffmpeg`, and `ffprobe` on PATH. Missing tools fail the suite; see
`media/README.md` for setup. On 2026-10-13 it passed
inside a container built from the pinned media base image with Debian's
SuperCollider 3.13.0 (`supercollider-server`, `supercollider-language`):

- Three bounded kits (19-EDO at 432 Hz, 5-limit JI at 261.63 Hz, 12-EDO at
  440 Hz; generated seeds truncated to 4 s) rendered at -18.0 LUFS, about
  -11 dBTP, master and delivery.
- Six sustained notes (degrees 1 and 4 of each kit) matched the tuning table
  within the 0.005-cent resolution of a Hann-windowed DTFT peak search
  (the 0.5-cent gate), which also recovers the pitch when started 3 cents
  away. Each note was already sounding in the first 10 ms (peak 0.10 to
  0.12), so the SynthDef loads before the first note.
- The dense 3072-voice fixture rendered in 4096 node slots.
- The `litmusRender` handler rendered and uploaded a two-member study family
  through fake tools.

The same run found the node-table and real-time-memory limits above; both
failed real renders before the fix. None of this establishes musical or
listening validity:
plan 11 steps 3 and 4 (studio comparison, contamination assessment, go or
no-go) remain human work.
