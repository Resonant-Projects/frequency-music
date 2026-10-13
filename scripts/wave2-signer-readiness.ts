#!/usr/bin/env -S vpx tsx
// Inherited environment only: no .env loading, credential discovery or network.
// Prints setting names, booleans and counts; never a configuration value.
import {
  assessSignerConfiguration,
  SIGNER_PLATFORMS,
} from "./lib/wave2-rollout";
import type { SignerPlatform } from "./lib/wave2-rollout";

const required: SignerPlatform[] = [];
for (const arg of process.argv.slice(2)) {
  const platform = /^--require=(.+)$/.exec(arg)?.[1];
  if (!platform || !SIGNER_PLATFORMS.includes(platform as SignerPlatform)) {
    console.error(
      JSON.stringify({ status: "failed", code: "invalid_arguments" }),
    );
    process.exit(2);
  }
  required.push(platform as SignerPlatform);
}
const report = assessSignerConfiguration(process.env);
const unready = required.filter(
  (platform) => !report.platforms[platform].ready,
);
console.log(JSON.stringify({ ...report, required, unready }, null, 2));
if (unready.length) process.exitCode = 1;
