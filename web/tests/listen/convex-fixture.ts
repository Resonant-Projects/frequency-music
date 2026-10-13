import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { getFunctionName } from "convex/server";
import { createMemo, createSignal } from "solid-js";
import type { QueryStatus } from "../../src/integrations/convex/query";
export { describeLoad } from "../../src/integrations/convex/query";
export const [state, setState] = createSignal("ready");
export const requests: unknown[] = [];
export function createQueryWithStatus<Q extends FunctionReference<"query">>(
  query: Q,
  args: () => FunctionArgs<Q>,
): QueryStatus<FunctionReturnType<Q>> {
  const name = getFunctionName(query);
  const data = createMemo(() => {
    const input = args();
    requests.push({ name, args: input });
    const current = state();
    let value: unknown;
    if (current === "loading" || current === "error") value = undefined;
    else if (name === "audioArtifacts:listReadyForTarget")
      value =
        current === "empty"
          ? []
          : [{ artifactId: "audio-one", title: "Study one" }];
    else if (name === "audioArtifacts:playback")
      value =
        current === "unavailable"
          ? null
          : {
              url: "/synthetic-audio.mp3",
              mimeType: "audio/mpeg",
              durationSecs: 12,
            };
    else throw new Error(`Unexpected query ${name}`);
    return value as FunctionReturnType<Q>;
  });
  return {
    data,
    error: () =>
      state() === "error" ? new Error("Authentication required") : null,
    isError: () => state() === "error",
    isLoading: () => state() === "loading",
  };
}
