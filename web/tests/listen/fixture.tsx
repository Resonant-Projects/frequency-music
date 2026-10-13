import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { TargetAudio } from "../../src/components/target-audio";
import { requests, setState } from "./convex-fixture";
const [kind, setKind] = createSignal<"recipe" | "composition">("recipe");
Object.assign(window, { listenFixture: { setState, setKind, requests } });
render(
  () => (
    <main>
      <h1>Audio fixture</h1>
      <TargetAudio
        target={
          kind() === "recipe"
            ? { kind: "recipe", id: "recipe-one" as Id<"recipes"> }
            : {
                kind: "composition",
                id: "composition-one" as Id<"compositions">,
              }
        }
      />
    </main>
  ),
  document.getElementById("app")!,
);
