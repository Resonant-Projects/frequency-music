import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vite-plus/test";

const supervisor = pathToFileURL(
  resolve("scripts/frequency-semantic-capture.mjs"),
).href;
function run(childCode: string, deadlineMs = 300, maxBytes = 4096) {
  const code = `import { supervise } from ${JSON.stringify(supervisor)};
const result = await supervise(process.execPath, ['-e', ${JSON.stringify(childCode)}], {deadlineMs:${deadlineMs},maxBytes:${maxBytes},env:{APP_ENV:"test"}});
console.log(JSON.stringify(result));`;
  const start = Date.now();
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { encoding: "utf8", timeout: 5000 },
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

test("terminates descendants retaining output pipes", () => {
  expect(
    run(
      "require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});process.exit(0)",
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
  const value = {
    format: "frequency-deployment-inspection-v1",
    deploymentAuthorized: false,
  };
  expect(run(`console.log(${JSON.stringify(JSON.stringify(value))})`)).toEqual({
    output: `${JSON.stringify(value)}\n`,
  });
});

test("CLI refuses absent credentials before launching inspector", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/frequency-semantic-capture.mjs"],
    { env: { APP_ENV: "test" }, encoding: "utf8", timeout: 5000 },
  );
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr)).toEqual({
    complete: false,
    code: "capture_invalid_input",
  });
});

test("interruption terminates the capture subprocess without releasing partial evidence", () => {
  const code = `import { supervise } from ${JSON.stringify(supervisor)};
setTimeout(()=>process.kill(process.pid,'SIGTERM'),200);
console.log(JSON.stringify(await supervise(process.execPath,['-e','setInterval(()=>{},1000)'],{deadlineMs:2000,env:{APP_ENV:"test"}})));`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { encoding: "utf8", timeout: 4000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    error: { complete: false, code: "capture_interrupted" },
  });
});
