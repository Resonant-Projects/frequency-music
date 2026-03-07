import { SolidMarkdown } from "solid-markdown";
import { css } from "../../../styled-system/css";

const components = {
  h2: (props: any) => (
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
  h3: (props: any) => (
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
  h4: (props: any) => (
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
  p: (props: any) => (
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
  blockquote: (props: any) => (
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
  ul: (props: any) => (
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
  ol: (props: any) => (
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
  li: (props: any) => (
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
  hr: (props: any) => (
    <hr
      class={css({
        border: "none",
        borderTop: "1px solid rgba(200, 168, 75, 0.22)",
        my: "6",
      })}
      {...props}
    />
  ),
  strong: (props: any) => (
    <strong
      class={css({ color: "rgba(245, 240, 232, 0.95)", fontWeight: "bold" })}
      {...props}
    />
  ),
  code: (props: any) => (
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
  a: (props: any) => (
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
