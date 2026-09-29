import { assembleEpisodeHandler } from "./assembleEpisode";
import { narrateHandler } from "./narrate";
import { probeHandler } from "./probe";
import { shootoutHandler } from "./shootout";
import type { JobHandler } from "./types";

export const handlers: Record<string, JobHandler> = {
  probe: probeHandler,
  narrate: narrateHandler,
  shootout: shootoutHandler,
  assembleEpisode: assembleEpisodeHandler,
};
