// Types shared by job handlers and the runner. Handlers never touch HTTP
// directly; they receive a ToolClient so tests can substitute fakes.
import type { AudioArtifactFields } from "../../../convex/shared/audioArtifacts";
import type {
  ArtifactResult,
  ClaimedMediaJob,
  MediaJobResult,
} from "../../../convex/shared/mediaJobs";

export type NewArtifact = Omit<
  AudioArtifactFields,
  "status" | "createdAt" | "updatedAt" | "refs"
> & {
  refs?: AudioArtifactFields["refs"];
};

export type ToolClient = {
  generateAudioUploadUrl: (args: {
    jobId: string;
    leaseToken: string;
    artifact: NewArtifact;
  }) => Promise<{ artifactId: string; uploadUrl: string }>;
  attachAudioStorage: (args: {
    jobId: string;
    leaseToken: string;
    artifactId: string;
    storageId: string;
  }) => Promise<null>;
  uploadBytes: (
    uploadUrl: string,
    path: string,
    mimeType: string,
    signal?: AbortSignal,
  ) => Promise<{ storageId: string }>;
};

export type JobContext = {
  job: ClaimedMediaJob;
  workDir: string;
  tools: ToolClient;
  rendererVersion: string;
  // Fires when the runner's job deadline passes; handlers forward it to every
  // subprocess and upload so nothing outlives the job's lease.
  signal: AbortSignal;
};

export type JobHandler = (ctx: JobContext) => Promise<MediaJobResult>;
export type { ArtifactResult };
