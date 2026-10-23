import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeFunctionReference } from "convex/server";
import { localClient, readRun } from "./client.mjs";

const run = process.argv[2];
const { directory } = readRun(run);
const client = localClient(run);
const userId = await client.mutation(
  makeFunctionReference("localVerification:seed"),
  {},
);
const identity = {
  subject: userId,
  issuer: "http://127.0.0.1:9",
  tokenIdentifier: `local|${userId}`,
  name: "Synthetic local operator",
};
writeFileSync(resolve(directory, "identity.json"), JSON.stringify(identity));
console.log(JSON.stringify({ status: "seeded", syntheticUserId: userId }));
