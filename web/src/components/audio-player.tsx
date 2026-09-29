import { createSignal, Show } from "solid-js";
import { css } from "../../styled-system/css";

const wrap = css({ display: "flex", flexDirection: "column", gap: "2" });
const labelClass = css({ color: "zodiac.cream/82", fontWeight: "600" });
const durationClass = css({ color: "zodiac.cream/66", ml: "2" });
const audioClass = css({ width: "100%" });
const errorClass = css({ color: "zodiac.error", fontSize: "sm" });

export function AudioPlayer(props: {
  src: string;
  label: string;
  durationSecs?: number;
}) {
  const [error, setError] = createSignal<string | null>(null);
  return (
    <div class={wrap}>
      <div class={labelClass}>
        {props.label}
        <Show when={props.durationSecs !== undefined}>
          <span class={durationClass}>
            {Math.round(props.durationSecs ?? 0)}s
          </span>
        </Show>
      </div>
      {/* biome-ignore lint/a11y/useMediaCaption: spoken-word takes have no caption track */}
      <audio
        controls
        preload="metadata"
        src={props.src}
        onError={() => setError("Could not load audio")}
        class={audioClass}
      />
      <Show when={error()}>
        <p class={errorClass}>{error()}</p>
      </Show>
    </div>
  );
}
