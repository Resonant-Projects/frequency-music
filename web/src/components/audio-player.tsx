import {
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { css, cx } from "../../styled-system/css";
import { focusRingClass, UINotice } from "./ui";

const wrap = css({ display: "flex", flexDirection: "column", gap: "2" });
const labelClass = css({ color: "zodiac.cream/82", fontWeight: "normal" });
const durationClass = css({ color: "zodiac.cream/66", ml: "2" });
const audioClass = css({ width: "full" });

// Every mounted player, so starting one pauses the rest: two native players
// talking over each other is never what the listener wants.
const players = new Set<HTMLAudioElement>();

function pauseOthers(playing: HTMLAudioElement) {
  for (const player of players) {
    if (player !== playing && !player.paused) player.pause();
  }
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

export function AudioPlayer(props: {
  src: string;
  label: string;
  durationSecs?: number;
  /** Heading level for the label; defaults to 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /**
   * Id for the label heading. The heading takes programmatic focus
   * (tabIndex -1), so a caller can park focus on it before a mutation
   * unmounts the control that had it.
   */
  headingId?: string;
  preload?: "none" | "metadata" | "auto";
}) {
  const [error, setError] = createSignal<string | null>(null);
  const fallbackId = createUniqueId();
  const headingId = () => props.headingId ?? `audio-${fallbackId}`;
  const titleId = () => `${headingId()}-title`;
  let audio: HTMLAudioElement | undefined;

  onMount(() => {
    if (audio) players.add(audio);
    onCleanup(() => {
      if (audio) players.delete(audio);
    });
  });

  return (
    <div class={wrap}>
      <Dynamic
        component={`h${props.headingLevel ?? 3}`}
        id={headingId()}
        tabIndex={-1}
        class={cx(labelClass, focusRingClass)}
      >
        <span id={titleId()}>{props.label}</span>
        <Show when={props.durationSecs !== undefined}>
          <span class={durationClass}>
            {formatDuration(props.durationSecs ?? 0)}
          </span>
        </Show>
      </Dynamic>
      {/* biome-ignore lint/a11y/useMediaCaption: spoken-word takes have no caption track */}
      <audio
        ref={(el) => {
          audio = el;
        }}
        controls
        aria-labelledby={titleId()}
        preload={props.preload ?? "metadata"}
        src={props.src}
        onPlay={(event) => pauseOthers(event.currentTarget)}
        onError={() => setError("Could not load audio")}
        class={audioClass}
      />
      <UINotice error={error()} />
    </div>
  );
}
