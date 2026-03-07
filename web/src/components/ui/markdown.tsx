import type { JSX } from "solid-js";
import { SolidMarkdown } from "solid-markdown";
import { css } from "../../../styled-system/css";

const components = {
  h2: (props: JSX.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      class={css({
        color: "zodiac.gold",
        fontFamily: "display",
        fontSize: "xl",
        mt: "5",
        mb: "2",
      })}
      {...props}
    />
  ),
  h3: (props: JSX.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      class={css({
        color: "zodiac.gold",
        fontFamily: "display",
        fontSize: "lg",
        mt: "4",
        mb: "2",
      })}
      {...props}
    />
  ),
  h4: (props: JSX.HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      class={css({
        color: "rgba(245, 240, 232, 0.92)",
        fontFamily: "display",
        fontSize: "md",
        mt: "4",
        mb: "2",
      })}
      {...props}
    />
  ),
  p: (props: JSX.HTMLAttributes<HTMLParagraphElement>) => (
    <p
      class={css({
        color: "rgba(245, 240, 232, 0.82)",
        fontFamily: "display",
        fontSize: "md",
        lineHeight: "1.75",
        mb: "3",
      })}
      {...props}
    />
  ),
  blockquote: (props: JSX.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      class={css({
        borderLeft: "2px solid rgba(200, 168, 75, 0.4)",
        color: "rgba(245, 240, 232, 0.74)",
        fontFamily: "display",
        fontStyle: "italic",
        lineHeight: "1.75",
        my: "5",
        pl: "4",
      })}
      {...props}
    />
  ),
  ul: (props: JSX.HTMLAttributes<HTMLUListElement>) => (
    <ul
      class={css({
        listStyleType: "disc",
        pl: "6",
        mb: "3",
        display: "flex",
        flexDirection: "column",
        gap: "1",
      })}
      {...props}
    />
  ),
  ol: (props: JSX.HTMLAttributes<HTMLOListElement>) => (
    <ol
      class={css({
        listStyleType: "decimal",
        pl: "6",
        mb: "3",
        display: "flex",
        flexDirection: "column",
        gap: "1",
      })}
      {...props}
    />
  ),
  li: (props: JSX.HTMLAttributes<HTMLLIElement>) => (
    <li
      class={css({
        color: "rgba(245, 240, 232, 0.82)",
        fontFamily: "display",
        fontSize: "md",
        lineHeight: "1.75",
      })}
      {...props}
    />
  ),
  hr: (props: JSX.HTMLAttributes<HTMLHRElement>) => (
    <hr
      class={css({
        border: "none",
        borderTop: "1px solid rgba(200, 168, 75, 0.22)",
        my: "6",
      })}
      {...props}
    />
  ),
  strong: (props: JSX.HTMLAttributes<HTMLElement>) => (
    <strong
      class={css({ color: "rgba(245, 240, 232, 0.95)", fontWeight: "bold" })}
      {...props}
    />
  ),
  code: (props: JSX.HTMLAttributes<HTMLElement>) => (
    <code
      class={css({
        fontFamily: "mono",
        fontSize: "sm",
        bg: "rgba(200, 168, 75, 0.08)",
        borderRadius: "sm",
        px: "1",
        py: "0.5",
      })}
      {...props}
    />
  ),
  a: (props: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      class={css({
        color: "zodiac.gold",
        textDecoration: "none",
        _hover: { textDecoration: "underline" },
      })}
      {...props}
    />
  ),
};

export function Markdown(props: { content: string }) {
  return <SolidMarkdown children={props.content} components={components} />;
}
