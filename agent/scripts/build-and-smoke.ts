import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export type AutomationEnv = {
  RUN_PROXMOX_SMOKE?: string | undefined;
  RUN_RESEARCH_PIPELINE_SMOKE?: string | undefined;
};

function automationEnvFromProcess(): AutomationEnv {
  return {
    RUN_PROXMOX_SMOKE: process.env.RUN_PROXMOX_SMOKE,
    RUN_RESEARCH_PIPELINE_SMOKE: process.env.RUN_RESEARCH_PIPELINE_SMOKE,
  };
}

export type AutomationStep = {
  name: string;
  command: string;
  args: string[];
  required: boolean;
};

export function shouldRunProxmoxSmoke(env: AutomationEnv = automationEnvFromProcess()): boolean {
  const value = env.RUN_PROXMOX_SMOKE?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function shouldRunResearchPipelineSmoke(env: AutomationEnv = automationEnvFromProcess()): boolean {
  const value = env.RUN_RESEARCH_PIPELINE_SMOKE?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function planAutomationSteps(env: AutomationEnv = automationEnvFromProcess()): AutomationStep[] {
  const steps: AutomationStep[] = [
    {
      name: "TypeScript typecheck",
      command: "bun",
      args: ["run", "verify"],
      required: true,
    },
    {
      name: "LangGraph Docker build",
      command: "bun",
      args: ["run", "build"],
      required: true,
    },
  ];

  if (shouldRunProxmoxSmoke(env)) {
    steps.push({
      name: "Optional Proxmox connectivity smoke",
      command: "bun",
      args: ["scripts/spike-proxmox.ts"],
      required: true,
    });
  }

  if (shouldRunResearchPipelineSmoke(env)) {
    steps.push({
      name: "Optional research-pipeline Convex audit smoke",
      command: "bun",
      args: ["scripts/smoke-research-pipeline.ts"],
      required: true,
    });
  }

  return steps;
}

function safeCommandLabel(step: AutomationStep): string {
  return [step.command, ...step.args].join(" ");
}

async function runStep(step: AutomationStep): Promise<void> {
  console.log(`\n▶ ${step.name}`);
  console.log(`  $ ${safeCommandLabel(step)}`);

  const exitCode = await new Promise<number | null>((resolve) => {
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: "inherit",
    });

    child.on("close", resolve);
    child.on("error", (error) => {
      console.error(`  Failed to start ${step.name}: ${error.message}`);
      resolve(1);
    });
  });

  if (exitCode !== 0) {
    throw new Error(`${step.name} failed with exit code ${exitCode ?? "unknown"}`);
  }

  console.log(`✓ ${step.name} passed`);
}

export async function runAutomation(env: AutomationEnv = automationEnvFromProcess()): Promise<void> {
  const runProxmoxSmoke = shouldRunProxmoxSmoke(env);
  const runResearchPipelineSmoke = shouldRunResearchPipelineSmoke(env);

  console.log("Local agent build/smoke automation");
  console.log(
    runProxmoxSmoke
      ? "Proxmox smoke: enabled via RUN_PROXMOX_SMOKE (secret values are not printed)"
      : "Proxmox smoke: skipped by default; set RUN_PROXMOX_SMOKE=true to enable",
  );
  console.log(
    runResearchPipelineSmoke
      ? "Research-pipeline smoke: enabled via RUN_RESEARCH_PIPELINE_SMOKE (secret values are not printed)"
      : "Research-pipeline smoke: skipped by default; set RUN_RESEARCH_PIPELINE_SMOKE=true to enable",
  );

  for (const step of planAutomationSteps(env)) {
    await runStep(step);
  }

  console.log("\nAll local automation steps passed.");
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  try {
    await runAutomation();
  } catch (error) {
    console.error(`\nAutomation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
