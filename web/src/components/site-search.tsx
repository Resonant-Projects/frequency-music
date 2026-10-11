import { useLocation } from "@tanstack/solid-router";
import {
  createEffect,
  createSignal,
  lazy,
  on,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { COLORS } from "../lib/zodiac-data";
import "./site-search.css";

const SearchResults = lazy(() => import("./site-search-results"));
export type SearchPage = { to: string; label: string };

export function SiteSearch(props: {
  pages: readonly SearchPage[];
  onOpen: () => void;
}) {
  const location = useLocation();
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [activeId, setActiveId] = createSignal<string>();
  const [shortcutLabel, setShortcutLabel] = createSignal("Ctrl K");
  let dialog!: HTMLDialogElement;
  let input: HTMLInputElement | undefined;

  function close() {
    if (!open()) return;
    dialog.close();
    setOpen(false);
    setQuery("");
    setActiveId(undefined);
    // Native dialog dismissal restores focus. Keep Escape free of a focus ring.
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  }
  function show() {
    props.onOpen();
    setOpen(true);
    dialog.showModal();
    input?.focus();
  }
  createEffect(on(() => location().pathname, close));
  onMount(() => {
    setShortcutLabel(
      /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘ K" : "Ctrl K",
    );
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return;
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        if (event.repeat) return;
        if (open()) close();
        else show();
      } else if (event.key === "Escape" && open()) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", shortcut, true);
    onCleanup(() => window.removeEventListener("keydown", shortcut, true));
  });

  function navigateResults(event: KeyboardEvent) {
    if (event.isComposing || event.target !== input) return;
    const links = Array.from(
      dialog.querySelectorAll<HTMLAnchorElement>('[role="option"]'),
    );
    if (!links.length) return;
    const index = links.findIndex((link) => link.id === activeId());
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next =
        event.key === "ArrowDown"
          ? (index + 1) % links.length
          : (index <= 0 ? links.length : index) - 1;
      setActiveId(links[next].id);
      links[next].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      (links[index] ?? links[0]).click();
    }
  }

  return (
    <div
      class="site-search"
      style={{
        "--search-void": COLORS.void,
        "--search-cream": COLORS.cream,
        "--search-gold": COLORS.gold,
      }}
    >
      <button
        type="button"
        class="site-search-trigger"
        aria-label="Search Frequency"
        aria-haspopup="dialog"
        aria-expanded={open()}
        aria-controls="site-search-panel"
        aria-keyshortcuts="Meta+k Control+k"
        onClick={show}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="5" />
          <path d="m12 12 5 5" />
        </svg>
        <span>Search</span>
        <kbd aria-hidden="true">{shortcutLabel()}</kbd>
      </button>
      <dialog
        ref={(element) => {
          dialog = element;
        }}
        id="site-search-panel"
        class="site-search-panel"
        aria-label="Search Frequency"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target !== dialog) return;
          const bounds = dialog.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            close();
        }}
        onKeyDown={navigateResults}
      >
        <Show when={open()}>
          <div class="site-search-field">
            <input
              ref={(element) => {
                input = element;
              }}
              type="search"
              role="combobox"
              aria-label="Search Frequency"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls="site-search-options"
              aria-activedescendant={activeId()}
              aria-describedby="site-search-help"
              placeholder="Search pages, concepts, research…"
              value={query()}
              onInput={(event) => {
                setQuery(event.currentTarget.value);
                setActiveId(undefined);
              }}
              autocomplete="off"
              spellcheck={false}
            />
            <button type="button" aria-label="Close search" onClick={close}>
              Esc
            </button>
          </div>
          <Suspense
            fallback={
              <p class="site-search-message" role="status">
                Loading search…
              </p>
            }
          >
            <SearchResults
              query={query()}
              pages={props.pages}
              activeId={activeId()}
              onHighlight={setActiveId}
              onSelect={close}
            />
          </Suspense>
          <div class="site-search-help" id="site-search-help">
            <span>
              <kbd>↑ ↓</kbd> Navigate
            </span>
            <span>
              <kbd>Enter</kbd> Open
            </span>
            <span>
              <kbd>Esc</kbd> Close
            </span>
          </div>
        </Show>
      </dialog>
    </div>
  );
}
