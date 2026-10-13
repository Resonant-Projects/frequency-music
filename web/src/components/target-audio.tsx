import type { FunctionArgs } from "convex/server";
import { For, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { css } from "../../styled-system/css";
import { createQueryWithStatus, describeLoad } from "../integrations/convex";
import { AudioPlayer } from "./audio-player";
import { goldDivider, sectionLabel, UINotice } from "./ui";

function ArtifactPlayer(props: {
  artifactId: Id<"audioArtifacts">;
  title: string;
}) {
  const playback = createQueryWithStatus(api.audioArtifacts.playback, () => ({
    artifactId: props.artifactId,
  }));
  const load = describeLoad(playback, "audio");
  return (
    <>
      <UINotice status={load.status()} error={load.error()} />
      <Show when={!playback.isError() && playback.data()}>
        {(audio) => (
          <AudioPlayer
            src={audio().url}
            label={props.title}
            durationSecs={audio().durationSecs}
            preload="none"
          />
        )}
      </Show>
    </>
  );
}

/** Identities come only from the authenticated, blind-safe server projection. */
export function TargetAudio(props: {
  target: FunctionArgs<typeof api.audioArtifacts.listReadyForTarget>["target"];
}) {
  const artifacts = createQueryWithStatus(
    api.audioArtifacts.listReadyForTarget,
    () => ({ target: props.target }),
  );
  const load = describeLoad(artifacts, "audio");
  return (
    <>
      <UINotice status={load.status()} error={load.error()} />
      <Show when={!artifacts.isError() && (artifacts.data()?.length ?? 0) > 0}>
        <hr class={goldDivider} />
        <h2 class={sectionLabel}>Listen</h2>
        <div class={css({ display: "grid", gap: "4", minInlineSize: "0" })}>
          <For each={artifacts.data()}>
            {(artifact) => (
              <ArtifactPlayer
                artifactId={artifact.artifactId}
                title={artifact.title}
              />
            )}
          </For>
        </div>
      </Show>
    </>
  );
}
