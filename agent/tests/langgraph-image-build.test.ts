import { expect, test } from "vite-plus/test";
import { verifyBuiltImage, type RunCommand } from "../scripts/build-image.js";

function commands(statuses: number[]) {
  const calls: { command: string; args: readonly string[] }[] = [];
  const run: RunCommand = (command, args) => {
    calls.push({ command, args });
    return statuses.shift() ?? 0;
  };
  return { run, calls };
}

test("a CLI exit 0 cannot pass without the image from this build attempt", () => {
  const { run, calls } = commands([0, 1]);
  expect(() =>
    verifyBuiltImage(
      run,
      ["node", ["cli", "build"]],
      "agent:attempt",
      "agent:local",
    ),
  ).toThrow(/produced no image/);
  expect(calls).toHaveLength(2);
  expect(calls[1]?.args).toEqual(["image", "inspect", "agent:attempt"]);
});

test("a failed CLI cannot promote an older image", () => {
  const { run, calls } = commands([1]);
  expect(() =>
    verifyBuiltImage(
      run,
      ["node", ["cli", "build"]],
      "agent:attempt",
      "agent:local",
    ),
  ).toThrow(/CLI build failed/);
  expect(calls).toHaveLength(1);
});

test("failed smoke checks cannot promote an image", () => {
  const { run, calls } = commands([0, 0, 1]);
  expect(() =>
    verifyBuiltImage(
      run,
      ["node", ["cli", "build"]],
      "agent:attempt",
      "agent:local",
    ),
  ).toThrow(/smoke check failed/);
  expect(calls.some((call) => call.args[0] === "tag")).toBe(false);
});

test("the verified candidate is promoted only after a network-free smoke check", () => {
  const { run, calls } = commands([0, 0, 0, 0]);
  verifyBuiltImage(
    run,
    ["node", ["cli", "build"]],
    "agent:attempt",
    "agent:local",
  );
  expect(calls[2]?.args).toContain("--network=none");
  expect(calls[2]?.args).toContain("agent:attempt");
  expect(calls[3]?.args).toEqual(["tag", "agent:attempt", "agent:local"]);
});
