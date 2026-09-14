import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vite-plus/test";

// Deliberately omit application credentials required by the ambient runtime env type.
const testEnvironment = { APP_ENV: "test" } as unknown as NodeJS.ProcessEnv;
const supervisor = pathToFileURL(
  resolve("scripts/frequency-semantic-capture.mjs"),
).href;
const value = {
  format: "frequency-deployment-inspection-v1",
  startedAt: "2026-09-14T00:00:00.000Z",
  finishedAt: "2026-09-14T00:00:01.000Z",
  consistency: "separate-query-snapshots-not-atomic",
  deploymentAuthorized: false,
  functionValidatorsIncluded: false,
  cronSpecsIncluded: false,
  cronSchedulesAndTargetsIncluded: true,
  componentArgumentsIncluded: false,
  schemaStructuralDeltaIncluded: false,
  components: [],
  modules: [],
  schemas: [],
};
function run(childCode: string, deadlineMs = 300, maxBytes = 4096) {
  const code = `import { supervise } from ${JSON.stringify(supervisor)};
const result = await supervise(process.execPath, ['-e', ${JSON.stringify(childCode)}], {deadlineMs:${deadlineMs},maxBytes:${maxBytes},env:{APP_ENV:"test"}});
console.log(JSON.stringify(result));`;
  const start = Date.now();
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { env: testEnvironment, encoding: "utf8", timeout: 5000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(Date.now() - start).toBeLessThan(3000);
  return JSON.parse(result.stdout);
}

test.each([
  "while(true) {}",
  "process.stdout.write('PRIVATE_PARTIAL'); setInterval(()=>{},1000)",
  "setInterval(()=>process.stdout.write('x'),20)",
])("wall-clock supervisor terminates stalled child without partial output: %s", (code) => {
  expect(run(code)).toEqual({
    error: { complete: false, code: "capture_deadline" },
  });
});

test("terminates a live capture group including descendants", () => {
  expect(
    run(
      "require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});setInterval(()=>{},1000)",
    ),
  ).toEqual({ error: { complete: false, code: "capture_deadline" } });
});

test("bounds stdout and stderr without exposing either on failure", () => {
  for (const stream of ["stdout", "stderr"]) {
    expect(
      run(
        `process.${stream}.write('PRIVATE'.repeat(2000));setInterval(()=>{},1000)`,
      ),
    ).toEqual({ error: { complete: false, code: "capture_output_limit" } });
  }
});

test("rejects child failure and malformed success, releasing only valid completed output", () => {
  expect(run("console.error('PRIVATE');process.exit(1)")).toEqual({
    error: { complete: false, code: "capture_child_failed" },
  });
  expect(run("console.log('PRIVATE')")).toEqual({
    error: { complete: false, code: "capture_invalid_output" },
  });
  expect(run(`console.log(${JSON.stringify(JSON.stringify(value))})`)).toEqual({
    output: `${JSON.stringify(value)}\n`,
  });
});

test("rejects envelopes missing any required inventory or coverage field", () => {
  for (const field of Object.keys(value)) {
    const incomplete = { ...value };
    delete incomplete[field as keyof typeof incomplete];
    expect(
      run(`console.log(${JSON.stringify(JSON.stringify(incomplete))})`),
    ).toEqual({
      error: { complete: false, code: "capture_invalid_output" },
    });
  }
});

test("CLI refuses absent credentials before launching inspector", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/frequency-semantic-capture.mjs"],
    { env: testEnvironment, encoding: "utf8", timeout: 5000 },
  );
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr)).toEqual({
    complete: false,
    code: "capture_invalid_input",
  });
});

test.each([
  "SIGTERM",
  "SIGINT",
  "SIGHUP",
])("%s terminates the capture subprocess without releasing partial evidence", (signal) => {
  const code = `import { supervise } from ${JSON.stringify(supervisor)};
setTimeout(()=>process.kill(process.pid,${JSON.stringify(signal)}),200);
console.log(JSON.stringify(await supervise(process.execPath,['-e','setInterval(()=>{},1000)'],{deadlineMs:2000,env:{APP_ENV:"test"}})));`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { env: testEnvironment, encoding: "utf8", timeout: 4000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    error: { complete: false, code: "capture_interrupted" },
  });
});

test("successful exit does not signal a reaped child PID or process group", () => {
  const code = `import { supervise } from ${JSON.stringify(supervisor)};
let signals=0;process.kill=()=>{signals++;return true};
const result=await supervise(process.execPath,['-e',${JSON.stringify(`console.log(${JSON.stringify(JSON.stringify(value))})`)}],{deadlineMs:2000,env:{APP_ENV:"test"}});
console.log(JSON.stringify({signals,result}));`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { env: testEnvironment, encoding: "utf8", timeout: 4000 },
  );
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).signals).toBe(0);
  expect(JSON.parse(result.stdout).result.output).toContain(
    "frequency-deployment-inspection-v1",
  );
});
