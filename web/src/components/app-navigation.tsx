import { NavigationMenu } from "@ark-ui/solid/navigation-menu";
import { Link, useLocation } from "@tanstack/solid-router";
import { createEffect, For, on, onMount, onCleanup } from "solid-js";
import { COLORS } from "../lib/zodiac-data";
import { navigationGroups } from "../lib/app-navigation";
import "./app-navigation.css";

export function AppNavigation(props: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const location = useLocation();
  const current = (path: string) =>
    path === "/"
      ? location().pathname === "/"
      : location().pathname === path ||
        location().pathname.startsWith(`${path}/`);
  createEffect(
    on(
      () => location().pathname,
      () => props.onValueChange(""),
    ),
  );
  onMount(() => {
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        !props.value ||
        event.isComposing ||
        event.defaultPrevented
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      props.onValueChange("");
    };
    window.addEventListener("keydown", dismissOnEscape, true);
    onCleanup(() =>
      window.removeEventListener("keydown", dismissOnEscape, true),
    );
  });
  const routeLink = (link: {
    to: string;
    label: string;
    description?: string;
  }) => (
    <NavigationMenu.Link
      current={current(link.to)}
      asChild={(linkProps) => (
        <Link
          {...linkProps()}
          to={link.to}
          class="app-menu-link"
          onClick={() => props.onValueChange("")}
        >
          <span>{link.label}</span>
          {link.description && <small>{link.description}</small>}
        </Link>
      )}
    />
  );
  return (
    <NavigationMenu.Root
      id="app-nav-menu"
      class="app-nav"
      style={{
        "--nav-void": COLORS.void,
        "--nav-cream": COLORS.cream,
        "--nav-gold": COLORS.gold,
      }}
      aria-label="Main navigation"
      value={props.value}
      onValueChange={(details) => props.onValueChange(details.value)}
      disableHoverTrigger
      lazyMount
      unmountOnExit
    >
      <NavigationMenu.List class="app-nav-list">
        <NavigationMenu.Item value="home" class="app-nav-desktop">
          <NavigationMenu.Link
            current={current("/")}
            asChild={(linkProps) => (
              <Link {...linkProps()} to="/" class="app-nav-control">
                Home
              </Link>
            )}
          />
        </NavigationMenu.Item>
        <For each={navigationGroups}>
          {(group) => (
            <NavigationMenu.Item value={group.label} class="app-nav-desktop">
              <NavigationMenu.Trigger
                class="app-nav-control"
                classList={{
                  "is-current-group": group.links.some((link) =>
                    current(link.to),
                  ),
                }}
              >
                {group.label}
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.3"
                  aria-hidden="true"
                >
                  <path d="m4 6 4 4 4-4" />
                </svg>
              </NavigationMenu.Trigger>
              <NavigationMenu.Content class="app-menu-panel">
                <div class="app-menu-links">
                  <For each={group.links}>{routeLink}</For>
                </div>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          )}
        </For>
        <NavigationMenu.Item value="mobile" class="app-nav-mobile">
          <NavigationMenu.Trigger
            class="app-nav-control app-mobile-trigger"
            aria-label="Open navigation menu"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              aria-hidden="true"
            >
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
            <span>Menu</span>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content class="app-menu-panel app-menu-mobile">
            {routeLink({ to: "/", label: "Home" })}
            <For each={navigationGroups}>
              {(group) => (
                <section class="app-menu-group" aria-label={group.label}>
                  <h2>{group.label}</h2>
                  <div class="app-menu-links">
                    <For each={group.links}>{routeLink}</For>
                  </div>
                </section>
              )}
            </For>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
