// Two-second real render for the image smoke test (render ladder 7):
// `node_modules/.bin/tsx src/engines/sc/smoke.ts`. Exits non-zero when
// SuperCollider, ffmpeg, or the loudness policy fails. Writes nothing outside
// its private temp directory.
import { renderLocal } from "./index";

const rendered = await renderLocal({
  version: 1,
  engine: "sc-litmus",
  tuning: { kind: "edo", divisions: 19 },
  referenceHz: 432,
  normalize: true,
  tempoBpm: 120,
  durationSecs: 2,
  seed: [
    { degree: 0, octave: 0, startBeat: 0, beats: 2, velocity: 100 },
    { degree: 6, octave: 0, startBeat: 1, beats: 3, velocity: 80 },
  ],
});
try {
  console.log(
    JSON.stringify({
      members: rendered.artifacts.map((artifact) => artifact.durationSecs),
    }),
  );
} finally {
  await rendered.dispose();
}
