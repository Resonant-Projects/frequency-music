import type { JSX } from "solid-js";
import { SolidMarkdown } from "solid-markdown";
import { css } from "../../../styled-system/css";

const components = {
  h1: (props: JSX.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      class={css({
        color: "zodiac.cream",
        fontFamily: "display",
        fontSize: "2xl",
        fontWeight: "normal",
        lineHeight: "1.3",
        mt: "6",
        mb: "3",
      })}
      {...props}
    />
  ),
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
        color: "zodiac.cream/92",
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
        color: "zodiac.cream/82",
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
        borderLeftWidth: "2px",
        borderLeftStyle: "solid",
        borderLeftColor: "zodiac.gold/40",
        color: "zodiac.cream/74",
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
        color: "zodiac.cream/82",
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
        borderTopWidth: "1px",
        borderTopStyle: "solid",
        borderTopColor: "zodiac.gold/22",
        my: "6",
      })}
      {...props}
    />
  ),
  strong: (props: JSX.HTMLAttributes<HTMLElement>) => (
    <strong
      class={css({ color: "zodiac.cream/95", fontWeight: "bold" })}
      {...props}
    />
  ),
  em: (props: JSX.HTMLAttributes<HTMLElement>) => (
    <em class={css({ fontStyle: "italic" })} {...props} />
  ),
  pre: (props: JSX.HTMLAttributes<HTMLPreElement>) => (
    <pre
      class={css({
        bg: "zodiac.void/50",
        borderRadius: "l1",
        fontFamily: "mono",
        fontSize: "sm",
        lineHeight: "1.6",
        overflow: "auto",
        p: "3",
        mb: "3",
      })}
      {...props}
    />
  ),
  code: (props: JSX.HTMLAttributes<HTMLElement>) => (
    <code
      class={css({
        fontFamily: "mono",
        fontSize: "sm",
        bg: "zodiac.gold/8",
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
  // Prose measure cap: the serif body face needs a short line. Consumers that
  // already cap narrower keep their own width; this is the floor for the rest.
  return (
    <div class={css({ maxW: "72ch" })}>
      <SolidMarkdown children={props.content} components={components} />
    </div>
  );
}
