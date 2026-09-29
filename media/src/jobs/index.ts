import { probeHandler } from "./probe";
import type { JobHandler } from "./types";

export const handlers: Record<string, JobHandler> = { probe: probeHandler };
