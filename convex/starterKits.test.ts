// Vite+ currently discovers root tests under convex/ and harness/. Import the
// script-library suites here so `vp run verify` exercises the starter-kit code.
import "../scripts/lib/tuning.test";
import "../scripts/lib/seedMidi.test";
import "../scripts/generate-starter-kit.test";
