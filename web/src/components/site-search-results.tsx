import { Link } from "@tanstack/solid-router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { api } from "../../../convex/_generated/api";
import { createQueryWithStatus } from "../integrations/convex";
import { buildAtlas } from "../lib/knowledge-atlas";
import { essayLibrary } from "../lib/essays";
import { useSpaceNavigation } from "../lib/space-navigation";
import type { SearchPage } from "./site-search";

export default function SiteSearchResults(props: {
  query: string;
  pages: readonly SearchPage[];
  onSelect: () => void;
  activeId: string | undefined;
  onHighlight: (id: string | undefined) => void;
}) {
  const navigation = useSpaceNavigation();
  const [term, setTerm] = createSignal("");
  createEffect(() => {
    const next = props.query.trim().toLowerCase();
    const timer = setTimeout(() => setTerm(next), 180);
    onCleanup(() => clearTimeout(timer));
  });
  const query = () => props.query.trim().toLowerCase();
  const active = () => query().length >= 2;
  const concepts = createQueryWithStatus(api.graph.searchConcepts, () =>
    term().length >= 2 ? { query: term(), limit: 20 } : "skip",
  );
  const pipeline = createQueryWithStatus(api.dashboard.pipelineItems, () =>
    active() ? {} : "skip",
  );
  const compositions = createQueryWithStatus(api.compositions.list, () =>
    active() ? { limit: 100 } : "skip",
  );
  const matches = (title: string) => title.toLowerCase().includes(query());
  const pages = createMemo(() =>
    props.pages.filter((page) => matches(page.label)),
  );
  const essays = createMemo(() =>
    active()
      ? essayLibrary.filter((essay) => matches(essay.title)).slice(0, 12)
      : [],
  );
  const research = createMemo(() =>
    active()
      ? buildAtlas(
          term() === query() ? (concepts.data() ?? []) : [],
          [],
          pipeline.data(),
        )
          .nodes.filter(
            (node) => node.kind === "concept" || matches(node.title),
          )
          .sort((a, b) => Number(matches(b.title)) - Number(matches(a.title)))
          .slice(0, 40)
      : [],
  );
  const works = createMemo(() =>
    active()
      ? (compositions.data() ?? [])
          .filter((item) => matches(item.title))
          .slice(0, 12)
      : [],
  );
  const loading = () =>
    active() &&
    (term() !== query() ||
      concepts.isLoading() ||
      pipeline.isLoading() ||
      compositions.isLoading());
  const failed = () =>
    active() &&
    (concepts.isError() || pipeline.isError() || compositions.isError());
  const optionId = (key: string) => `search-result-${encodeURIComponent(key)}`;
  const optionProps = (key: string) => ({
    id: optionId(key),
    role: "option" as const,
    tabIndex: -1,
    "aria-selected": props.activeId === optionId(key),
    onPointerMove: () => props.onHighlight(optionId(key)),
    onMouseDown: (event: MouseEvent) => event.preventDefault(),
  });
  createEffect(() => {
    const keys = [
      ...pages().map((page) => `page:${page.to}`),
      ...research().map((node) => `node:${node.id}`),
      ...essays().map((essay) => `essay:${essay.slug}`),
      ...works().map((work) => `work:${work._id}`),
    ];
    if (props.activeId && !keys.some((key) => optionId(key) === props.activeId))
      props.onHighlight(undefined);
  });
  return (
    <div class="site-search-results zodiac-scroll">
      <div
        id="site-search-options"
        role="listbox"
        aria-label="Search results"
        aria-busy={loading()}
      >
        <Show when={pages().length}>
          <div role="group" aria-label="Pages">
            <h2 aria-hidden="true">Pages</h2>
            <For each={pages()}>
              {(page) => (
                <Link
                  {...optionProps(`page:${page.to}`)}
                  to={page.to}
                  onClick={props.onSelect}
                >
                  <span>{page.label}</span>
                  <small>Page</small>
                </Link>
              )}
            </For>
          </div>
        </Show>
        <Show when={research().length}>
          <div role="group" aria-label="Concepts &amp; recent research">
            <h2 aria-hidden="true">Concepts &amp; recent research</h2>
            <For each={research()}>
              {(node) => (
                <Link
                  {...optionProps(`node:${node.id}`)}
                  to="/"
                  onClick={() => {
                    navigation.select(node);
                    props.onSelect();
                  }}
                >
                  <span>{node.title}</span>
                  <small>{node.kind}</small>
                </Link>
              )}
            </For>
          </div>
        </Show>
        <Show when={essays().length}>
          <div role="group" aria-label="Essays">
            <h2 aria-hidden="true">Essays</h2>
            <For each={essays()}>
              {(essay) => (
                <Link
                  {...optionProps(`essay:${essay.slug}`)}
                  to="/essays/$essaySlug"
                  params={{ essaySlug: essay.slug }}
                  onClick={props.onSelect}
                >
                  <span>{essay.title}</span>
                  <small>Essay</small>
                </Link>
              )}
            </For>
          </div>
        </Show>
        <Show when={works().length}>
          <div role="group" aria-label="Compositions">
            <h2 aria-hidden="true">Compositions</h2>
            <For each={works()}>
              {(work) => (
                <Link
                  {...optionProps(`work:${work._id}`)}
                  to="/compositions/$compositionId"
                  params={{ compositionId: work._id }}
                  onClick={props.onSelect}
                >
                  <span>{work.title}</span>
                  <small>Composition</small>
                </Link>
              )}
            </For>
          </div>
        </Show>
      </div>
      <p class="site-search-message" role="status">
        {loading()
          ? "Searching…"
          : active() &&
              !pages().length &&
              !research().length &&
              !essays().length &&
              !works().length
            ? "No matches. Try a different name or title."
            : !active()
              ? "Type at least two characters to search research and essays."
              : ""}
      </p>
      <p class="site-search-message" role="alert">
        {failed()
          ? "Some research could not load. Pages and essays are still available."
          : ""}
      </p>
      <Show when={active()}>
        <p class="site-search-scope">
          Concept index, essay titles, 200 latest sources and 100 latest
          extractions, hypotheses, recipes and compositions.
        </p>
      </Show>
    </div>
  );
}
