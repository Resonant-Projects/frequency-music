import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import "../../src/index.css";
import "../../styled-system/styles.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/jetbrains-mono/400.css";
import { IntentReview } from "../../src/components/intent-review";

function Fixture() {
  const [calls, setCalls] = createSignal(0);
  const [identity, setIdentity] = createSignal("one");
  const [canDecide, setCanDecide] = createSignal(true);
  const [status, setStatus] = createSignal("Proposed");
  const [expiresAt, setExpiresAt] = createSignal(Date.now() + 30 * 60 * 1000);
  let resolve: (() => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  function submit() {
    setCalls((count) => count + 1);
    return new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
  }
  return (
    <>
      <p>Local fixture with synthetic data. No backend connection.</p>
      <output aria-label="Mutation calls">{calls()}</output>
      <button onClick={() => resolve?.()}>Resolve request</button>
      <button
        onClick={() =>
          reject?.(new Error("Target changed. Request a new proposal."))
        }
      >
        Reject request
      </button>
      <button
        onClick={() => {
          setStatus("Applied");
          setCanDecide(false);
        }}
      >
        Publish applied status
      </button>
      <button onClick={() => setExpiresAt(Date.now() - 1)}>
        Expire proposal
      </button>
      <button onClick={() => setIdentity("two")}>Open another intent</button>
      <IntentReview
        identity={identity()}
        code={`D-${identity()}`}
        targetTitle="Synthetic composition"
        actionLabel="Save listening feedback"
        payloadText={
          '{\n  "bodilyPleasantness": 4,\n  "goosebumps": "not given",\n  "conditions": "headphones, evening"\n}'
        }
        payloadDigest={"a".repeat(64)}
        note="Synthetic voice transcript"
        expiresAt={expiresAt()}
        statusLabel={status()}
        canDecide={canDecide()}
        onConfirm={submit}
        onCancel={submit}
      />
    </>
  );
}
render(() => <Fixture />, document.getElementById("app")!);
