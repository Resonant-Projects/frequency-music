// Root install lifecycle: keep the packages' separate lockfiles while making
// `vp i` install everything needed by the cross-package scripts and tests.
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);

for (const name of ["web", "agent", "media"]) {
  console.log(`Installing ${name}/ dependencies from its lockfile`);
  execFileSync("vp", ["install", "--frozen-lockfile"], {
    cwd: new URL(`${name}/`, root),
    stdio: "inherit",
  });
}

// The web typecheck imports these generated files before dev/build can run.
execFileSync("vp", ["run", "codegen"], {
  cwd: new URL("web/", root),
  stdio: "inherit",
});
