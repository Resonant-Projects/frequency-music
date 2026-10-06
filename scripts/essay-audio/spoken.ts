// Turns a Frequency essay (docs/essays/<slug>.md) into a script a TTS voice
// can read aloud. The written essay stays the source of truth: this only
// rewrites what a voice cannot say (ratios, notation, record ids, link
// syntax, tables) and marks where the sections begin, so the renderer can
// pause and announce them.

import { Lexer, type Token, type Tokens } from "marked";

export type SegmentRole =
  | "intro"
  | "heading"
  | "subheading"
  | "paragraph"
  | "outro";

export type SpokenSegment = {
  role: SegmentRole;
  text: string;
  // A horizontal rule or a dropped block sits between this segment and the
  // previous one: the renderer gives it a longer pause.
  breakBefore?: boolean;
};

export type SpokenEssay = {
  slug: string;
  title: string;
  segments: SpokenSegment[];
  // Chapter marks: the intro, then one per numbered section heading.
  chapters: { title: string; startParagraph: number }[];
  // Anything the converter could not make speakable. An essay with warnings
  // needs an override (or a human listen) before it is published.
  warnings: string[];
  // Blocks left out with a spoken notice (tables, code). Not blocking.
  omissions: string[];
};

export type EssayOverride = {
  // Exact replacements applied to the markdown before conversion: the way
  // to give a display equation or a table a spoken form.
  source?: { from: string; to: string }[];
  // Exact replacements applied to each segment after normalization.
  replace?: { from: string; to: string }[];
  // Reason to leave the essay out of the audio queue entirely.
  skip?: string;
};

// Section headings that introduce a citation list rather than prose.
const DROPPED_SECTIONS =
  /^(sources|references|bibliography|further reading|notes|citations)$/i;

const ORDINALS = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
  "Ninth",
  "Tenth",
];

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

const FRACTION_DENOMINATORS: Record<number, [string, string]> = {
  2: ["half", "halves"],
  3: ["third", "thirds"],
  4: ["quarter", "quarters"],
  5: ["fifth", "fifths"],
  6: ["sixth", "sixths"],
  7: ["seventh", "sevenths"],
  8: ["eighth", "eighths"],
  9: ["ninth", "ninths"],
  10: ["tenth", "tenths"],
};

const GREEK: Record<string, string> = {
  alpha: "alpha",
  beta: "beta",
  gamma: "gamma",
  delta: "delta",
  epsilon: "epsilon",
  theta: "theta",
  lambda: "lambda",
  mu: "mu",
  pi: "pi",
  rho: "rho",
  sigma: "sigma",
  tau: "tau",
  phi: "phi",
  omega: "omega",
  Delta: "delta",
  Sigma: "sigma",
  Omega: "omega",
};

const UNICODE_GREEK: Record<string, string> = {
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "epsilon",
  θ: "theta",
  λ: "lambda",
  μ: "mu",
  π: "pi",
  ρ: "rho",
  σ: "sigma",
  τ: "tau",
  φ: "phi",
  ω: "omega",
  Δ: "delta",
  Σ: "sigma",
  Ω: "omega",
};

const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUPERSCRIPT_MINUS = "⁻";
const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function sectionOrdinal(n: number): string {
  return numberWord(n);
}

// Spoken form of the LaTeX that appears inline in the essays: fractions,
// powers, roots, subscripts, Greek letters, and a few operators. Anything
// still carrying a backslash or brace afterwards is reported, not guessed.
export function speakLatex(source: string): string {
  // Every expansion is padded with spaces so it cannot fuse with a
  // neighbouring token. A whole number right before a numeric fraction is
  // a mixed number (3\frac{1}{2}); before a symbolic one it is a product.
  let text = source.replaceAll(/(\d)\s*(?=\\frac\{\d+\}\{\d+\})/g, "$1 and ");
  for (let i = 0; i < 4; i++) {
    text = text.replaceAll(
      /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
      (_, a: string, b: string) => ` ${a} over ${b} `,
    );
    text = text.replaceAll(
      /\\sqrt\{([^{}]*)\}/g,
      (_, a: string) => ` the square root of ${a} `,
    );
  }
  text = text
    .replaceAll(/\^(?:\{2\}|2(?!\d))/g, " squared ")
    .replaceAll(/\^(?:\{3\}|3(?!\d))/g, " cubed ")
    .replaceAll(/\^\{([^{}]*)\}/g, " to the power $1 ")
    .replaceAll(/\^(\\?\w+)/g, " to the power $1 ")
    .replaceAll(/_\{([^{}]*)\}/g, " sub $1 ")
    .replaceAll(/_(\w)/g, " sub $1 ")
    // Whole commands only: \cdots is not \cdot, \lnot is not \ln.
    .replaceAll(/\\(?:cdots|ldots|dots)\b/g, " and so on ")
    .replaceAll(/\\(?:cdot|times)\b/g, " times ")
    .replaceAll(/\\propto\b/g, " is proportional to ")
    .replaceAll(/\\approx\b/g, " is approximately ")
    .replaceAll(/\\(?:leq|le)\b/g, " is at most ")
    .replaceAll(/\\(?:geq|ge)\b/g, " is at least ")
    .replaceAll(/\\neq\b/g, " is not equal to ")
    .replaceAll(/\\(sin|cos|tan|exp)\b/g, " $1 ")
    .replaceAll(/\\log\b/g, "log ")
    .replaceAll(/\\ln\b/g, "natural log of ")
    .replaceAll(/\\(?:rightarrow|to)\b/g, " to ")
    .replaceAll(/\\leftarrow\b/g, " from ")
    .replaceAll(/\\Rightarrow\b/g, " implies ")
    .replaceAll(/\\(?:left|right)\b/g, "")
    .replaceAll(/\\([A-Za-z]+)/g, (match, name: string) =>
      GREEK[name] ? ` ${GREEK[name]} ` : match,
    )
    .replaceAll(/!=|\\ne\b/g, " is not equal to ")
    .replaceAll("<=", " is at most ")
    .replaceAll(">=", " is at least ")
    .replaceAll("==", " equals ")
    .replaceAll(/\\lt\b|</g, " less than ")
    .replaceAll(/\\gt\b|>/g, " greater than ")
    .replaceAll("=", " equals ")
    .replaceAll("+", " plus ")
    .replaceAll("*", " times ")
    .replaceAll(/(?<=\S)\s*-\s*(?=\S)/g, " minus ")
    .replaceAll("/", " over ");
  return text.replaceAll(/\s+/g, " ").trim();
}

function fractionWords(num: number, den: number): string | undefined {
  const names = FRACTION_DENOMINATORS[den];
  if (!names || num < 1 || num >= den) return undefined;
  return `${numberWord(num)} ${num === 1 ? names[0] : names[1]}`;
}

// A rhythm grid such as `x . . x . x .`: onsets and rests.
function speakRhythm(grid: string): string {
  return grid
    .split(/\s+/)
    .map((cell) => (cell === "x" ? "hit" : "rest"))
    .join(", ");
}

// Inline normalization for one block of prose.
export function normalizeProse(input: string): string {
  let text = input;

  // Record ids (Convex document ids) and repository paths are provenance for
  // the written page; a listener cannot use them. Drop them with any
  // parentheses or list punctuation they sat in.
  const recordId = "`(?:j[0-9a-z]|k[0-9a-z]|jx)[0-9a-z]{28,}`";
  text = text
    .replaceAll(new RegExp(`\\s*\\((?:${recordId}(?:,\\s*)?)+\\)`, "g"), "")
    .replaceAll(new RegExp(`${recordId}\\s*`, "g"), "")
    .replaceAll(/\s*\(`(?:data|docs|scripts|out)\/[^`]*`\)/g, "")
    .replaceAll(/`(?:data|docs|scripts|out)\/[^`]*`/g, "the project's data");

  // Code spans: rhythm grids and bit strings get a spoken form; anything
  // else keeps its text.
  text = text
    .replaceAll(/`([x.](?: [x.])+)`/g, (_, grid: string) => speakRhythm(grid))
    .replaceAll(/`([01]{4,})`/g, (_, bits: string) =>
      bits
        .split("")
        .map((bit) => (bit === "1" ? "one" : "zero"))
        .join(" "),
    )
    .replaceAll(/`([^`]*)`/g, "$1");

  // Inline LaTeX first, so neither the HTML, emphasis, nor symbol rules
  // can read its <, >, or _ as markup.
  text = text.replaceAll(/\$([^$]+)\$/g, (_, tex: string) => speakLatex(tex));

  // Links, images, footnotes, citations, URLs, HTML.
  text = text
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replaceAll(/\[\^[^\]]+\]/g, "")
    .replaceAll(/\s*\[S\d+(?:[,;–-]\s*S?\d+)*\]/g, "")
    .replaceAll(/\s*\(?<?https?:\/\/[^\s)>]*[^\s)>.,;:]>?\)?/g, "");
  // No HTML is removed: the essays contain none, and x<a>b is mathematics.
  // Tag-like text is reported by toSpokenEssay instead.

  // Emphasis markers. Emphasis hugs its text; "2 * 3" and "2 ** 3" are
  // arithmetic and stay for the lint.
  text = text
    .replaceAll(/(?<![\w*])\*\*(?=\S)([^*]*?\S)\*\*(?![\w*])/g, "$1")
    .replaceAll(/(?<![\w_])__(?=\S)([^_]*?\S)__(?![\w_])/g, "$1")
    .replaceAll(/(?<![\w*])\*(?=\S)([^*\n]*?\S)\*(?![\w*])/g, "$1")
    .replaceAll(/(?<![\w_])_(?=\S)([^_\n]*?\S)_(?![\w_])/g, "$1");

  // Essay numbers: "(#64)" after a title is dropped; "#82 asked" and
  // "essay #84" become "essay 82" and "essay 84".
  text = text
    .replaceAll(/\\"/g, '"')
    .replaceAll(/\s*\(#\d+\)/g, "")
    .replaceAll(/\b[Ee]ssays? #(\d+)/g, (match, n: string) =>
      match.startsWith("E") ? `Essay ${n}` : `essay ${n}`,
    )
    .replaceAll(/(^|[\s(])#(\d+)/g, "$1essay $2");

  // Rates are "per" ("samples/second"); any other word slash is read as
  // alternatives ("major/minor"), not "slash".
  text = text
    .replaceAll(
      /(?<=\p{L})\/(second|sec|s|minute|min|hour|day|sample|frame|octave|beat|bar|cycle|word|token|step|channel)\b/gu,
      " per $1",
    )
    .replaceAll(/\band\/or\b/g, "and or")
    // A slash pair naming a ratio is "to" ("signal/noise ratio").
    .replaceAll(
      /\b([\p{L}][\p{L}\d-]*)\/([\p{L}][\p{L}\d-]*)(?=\s+ratios?\b)/gu,
      "$1-to-$2",
    )
    // A spaced slash between words separates phrases ("stable core /
    // adaptive surface"); "1 / 2" and "x / y" are division, left for the lint.
    .replaceAll(/(?<=\p{L}{2})\s+\/\s+(?=\p{L}{2})/gu, ", ")
    .replaceAll(/\bA\/B\/C\b/g, "A-B-C")
    .replaceAll(/\bA\/B\b/g, "A-B")
    .replaceAll(/\bI\/O\b/g, "I-O")
    // Two terms of two or more characters, each with a letter ("major/minor",
    // "MP3/OGG", "2-note/2-chord"), are alternatives. Single letters (x/y)
    // are division and numbers are fractions: both are left for the lint.
    .replaceAll(
      /(?<![\p{L}\d-])([\p{L}\d][\p{L}\d-]*)((?:\/[\p{L}\d][\p{L}\d-]*)+)/gu,
      (match, first: string, rest: string) => {
        const terms = [first, ...rest.slice(1).split("/")];
        const wordy = terms.every(
          (term) => term.length >= 2 && /\p{L}/u.test(term),
        );
        return wordy ? terms.join(" or ") : match;
      },
    );

  // Identifiers such as UPV_RIR_DB: an underscore is a word break.
  text = text.replaceAll(/(?<=\w)_(?=\w)/g, " ");

  // Abbreviations a voice reads literally or stumbles over.
  text = text
    .replaceAll(/\be\.g\.,?/g, "for example,")
    .replaceAll(/\bi\.e\.,?/g, "that is,")
    .replaceAll(/\bet al\.(?=\s|,|$)/g, "and colleagues")
    .replaceAll(/\betc\.(?=\s*[a-z])/g, "et cetera")
    .replaceAll(/\betc\./g, "et cetera.")
    .replaceAll(/\bvs\.?(?=\s)/g, "versus")
    .replaceAll(/\bcf\.(?=\s)/g, "compare")
    .replaceAll(/\bapprox\.(?=\s)/g, "approximately")
    .replaceAll(/\bw\/(?=\s)/g, "with");

  // Note names and powers written in plain text.
  text = text
    .replaceAll(/\b([A-G])(?:#|♯)(?=[\s,.;:)-]|$)/g, "$1 sharp")
    .replaceAll(/\b([A-G])♭/g, "$1 flat")
    .replaceAll(/(\w)\^\(([^()]+)\)/g, "$1 to the power $2 ")
    .replaceAll(/(?<![\d./])(\d+\.\d+)\/(\d+)\b(?![./]\d|\/)/g, "$1 out of $2");

  // Tuning-system shorthand.
  text = text
    .replaceAll(/\b(\d+)[- ]?(?:TET|tET|ET)\b/g, "$1-tone equal temperament")
    .replaceAll(/\b(\d+)[- ]?EDO\b/g, "$1 equal divisions of the octave")
    .replaceAll(/\b(\d+)[- ]?edo\b/g, "$1 equal divisions of the octave")
    .replaceAll(/\bTET\b/g, "equal temperament")
    .replaceAll(/\bEDOs\b/g, "equal divisions of the octave")
    .replaceAll(/\bEDO\b/g, "equal division of the octave");

  // A sign before a number is spoken before any fraction is spelled out.
  text = text.replaceAll(/(^|[\s(])[−-](?=\d)/g, "$1minus ");

  // Ranges, ratios, and fractions. Ranges first so "3–5" is not read as a
  // dash; ratios before fractions so "81:80" never reaches the slash rule.
  text = text
    .replaceAll(/(\d)\s?–\s?(\d)/g, "$1 to $2")
    // A hyphen between numbers is a range only when it ascends (3-5,
    // 0.09-0.57, 1995-2005); anything else is left for the lint. A full stop
    // after the range ends the sentence unless a digit follows it.
    .replaceAll(
      /(?<![\w.,-])(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?![.,]\d|[\w:/-])/g,
      (match, a: string, b: string) =>
        Number(a) < Number(b) ? `${a} to ${b}` : match,
    )
    .replaceAll(
      /(?<![\w:.])(\d+(?:\.\d+)?)((?::\d+(?:\.\d+)?)+)(?!\s?(?:am|pm|AM|PM)\b)(?![\w:⁰-⁹¹²³⁻])/g,
      (_, first: string, rest: string) =>
        [first, ...rest.slice(1).split(":")].join(" to "),
    )
    .replaceAll(
      /(?<![\w/.])(\d+)\/(\d+)(?=\s+(?:time|meter|metre|signature)\b)/g,
      "$1 $2",
    )
    .replaceAll(
      // A power on the denominator (2/3²) is not a plain fraction: left for
      // the lint rather than read as "two thirds squared".
      /(?<![\w/.,])(\d+)\/(\d+)(?![\w/⁰-⁹¹²³⁻]|[.,]\d)/g,
      (_, a: string, b: string) => {
        const num = Number(a);
        const den = Number(b);
        if (num >= den) return `${a} to ${b}`;
        return fractionWords(num, den) ?? `${a} over ${b}`;
      },
    )
    .replaceAll(/(?<![\w/])(\d+)\/([a-zA-Z])\b/g, "$1 over $2");

  // Units after numbers.
  const units: [RegExp, string][] = [
    [/(\d)\s?kHz\b/g, "$1 kilohertz"],
    [/(\d)\s?Hz\b/g, "$1 hertz"],
    [/(\d)\s?kbps\b/g, "$1 kilobits per second"],
    [/(\d)\s?Mbps\b/g, "$1 megabits per second"],
    [/(\d)\s?dBFS\b/g, "$1 decibels full scale"],
    [/(\d)\s?dBTP\b/g, "$1 decibels true peak"],
    [/(\d)\s?dB\b/g, "$1 decibels"],
    [/(\d)\s?LUFS\b/g, "$1 L U F S"],
    [/(\d)\s?ms\b/g, "$1 milliseconds"],
    [/(\d)\s?kg\b/g, "$1 kilograms"],
  ];
  for (const [pattern, spoken] of units)
    text = text.replaceAll(pattern, spoken);

  // Unicode powers, subscripts, and Greek letters.
  text = text
    .replaceAll(
      new RegExp(`(\\w)(${SUPERSCRIPT_MINUS}?)([${SUPERSCRIPTS}]+)`, "gu"),
      (_, base: string, sign: string, sup: string) => {
        const power = sup
          .split("")
          .map((c) => SUPERSCRIPTS.indexOf(c))
          .join("");
        if (sign) return `${base} to the minus ${power} `;
        if (power === "2") return `${base} squared `;
        if (power === "3") return `${base} cubed `;
        return `${base} to the ${power} `;
      },
    )
    .replaceAll(
      new RegExp(`(\\w)([${SUBSCRIPTS}]+)`, "gu"),
      (_, base: string, sub: string) =>
        `${base} ${sub
          .split("")
          .map((c) => SUBSCRIPTS.indexOf(c))
          .join("")} `,
    )
    .replaceAll(/μg\b/g, "micrograms")
    .replaceAll(/(\d)\s?μs\b/g, "$1 microseconds")
    .replaceAll(/[αβγδεθλμπρσφωΔΣΩ]/g, (c) => ` ${UNICODE_GREEK[c] ?? c} `)
    .replaceAll("·", " times ");

  // Signs and symbols.
  text = text
    .replaceAll(/(^|[\s(])~(?=\d)/g, "$1about ")
    .replaceAll(/(\d)\s?×\s?(\d)/g, "$1 by $2")
    .replaceAll("×", " times ")
    .replaceAll("÷", " divided by ")
    .replaceAll("±", " plus or minus ")
    .replaceAll("≈", " approximately ")
    .replaceAll("≠", " is not equal to ")
    .replaceAll("≥", " at least ")
    .replaceAll("≤", " at most ")
    .replaceAll(/\s*(?:→|->)\s*/g, " to ")
    .replaceAll(/\s*(?:<-|←)\s*/g, " from ")
    .replaceAll(/\s*!=\s*/g, " is not equal to ")
    .replaceAll(/\s*<=\s*/g, " is at most ")
    .replaceAll(/\s*>=\s*/g, " is at least ")
    .replaceAll(/\s*==\s*/g, " equals ")
    .replaceAll(/\s*<\s*/g, " less than ")
    .replaceAll(/\s*>\s*/g, " greater than ")
    .replaceAll(/\s*=\s*/g, " equals ")
    .replaceAll(/(\S)\s*−\s*(\S)/g, "$1 minus $2")
    .replaceAll(/(\p{L})–(\p{L})/gu, "$1-$2")
    .replaceAll(/\s*↔\s*/g, " and ")
    .replaceAll(/\s*⇒\s*/g, " implies ")
    .replaceAll("√", " the square root of ")
    .replaceAll("∞", "infinity")
    .replaceAll("²", " squared ")
    .replaceAll("³", " cubed ")
    .replaceAll("°", " degrees")
    .replaceAll(/\s&\s/g, " and ")
    .replaceAll(/,\s*(?:\.\.\.|…)\s*\)/g, ", and so on)")
    .replaceAll(/\s*(?:\.\.\.|…)\s*\)/g, ", and so on)")
    .replaceAll(/\s+—\s+/g, " — ");

  return text
    .replaceAll(/\(\s*\)/g, "")
    .replaceAll(/\s+([,.;:!?])/g, "$1")
    .replaceAll(/\s+/g, " ")
    .trim();
}

// Characters and shapes that survived normalization and that a voice would
// read wrongly. Reported as warnings; publishing waits for an override.
const RESIDUE: [RegExp, string][] = [
  [/[\\${}^|<>=#*[\]`_]/, "markup or math symbol"],
  [/\d\s*[/:]\s*\d/, "unconverted ratio or fraction"],
  [/https?:|www\./, "URL"],
  [/[\u2070-\u209F]/u, "unconverted superscript or subscript"],
  [/\/|!(?=[=\w])/, "unconverted slash or operator"],
  [/\d-\d/, "hyphen between numbers"],
  [/(^|[\s(])-(?=[a-z])/, "sign or dash before a word"],
  [
    /[\u2100-\u214F\u2200-\u22FF\u27C0-\u27EF\u2980-\u2AFF]/u,
    "unconverted mathematical symbol",
  ],
  [/\b[0-9a-z]{24,}\b/, "opaque identifier"],
];

function lint(text: string, where: string, warnings: string[]): void {
  for (const [pattern, label] of RESIDUE) {
    const match = text.match(pattern);
    if (match) {
      const at = match.index ?? 0;
      warnings.push(
        `${where}: ${label} near "${text.slice(Math.max(0, at - 30), at + 30)}"`,
      );
    }
  }
}

// The only inline code read without an override: record ids and repository
// paths (dropped), rhythm grids, and bit strings (spoken by normalizeProse).
const SPEAKABLE_CODE = [
  /^(?:j[0-9a-z]|k[0-9a-z]|jx)[0-9a-z]{28,}$/,
  /^(?:data|docs|scripts|out)\//,
  /^[x.](?: [x.])+$/,
  /^[01]{4,}$/,
];

function cleanHeading(raw: string): string {
  // "2. Method" loses its list-style number; "0.5 seconds" keeps its value.
  return normalizeProse(raw.replace(/^\d+\.\s+/, ""))
    .replace(/[.:]$/, "")
    .trim();
}

function endWithStop(text: string): string {
  if (/[:;,]$/.test(text)) return `${text.slice(0, -1)}.`;
  return /[.!?]["”’)]*$/.test(text) ? text : `${text}.`;
}

// Block structure comes from a CommonMark lexer, so fences of either kind,
// indented code, lists, tables, and quotes are recognized by the spec rather
// than by line patterns.
function lex(markdown: string): Token[] {
  return new Lexer({ gfm: true }).lex(markdown);
}

export function displayTitle(markdown: string, slug: string): string {
  const heading = lex(markdown).find(
    (token): token is Tokens.Heading =>
      token.type === "heading" && token.depth === 1,
  );
  return heading ? cleanHeading(heading.text) : slug.replaceAll("-", " ");
}

// The short title used in the intro, the outro, and the episode name: the
// part before a subtitle colon.
export function shortTitle(title: string): string {
  return title.split(/:\s/)[0] ?? title;
}

const OMITTED = {
  code: "The written essay includes a code listing here; it is left out of the audio edition.",
  table:
    "The written essay includes a table here; it is left out of the audio edition.",
  equation:
    "The written essay shows an equation here; it is left out of the audio edition.",
};

export function toSpokenEssay(
  slug: string,
  markdown: string,
  override: EssayOverride = {},
): SpokenEssay {
  const warnings: string[] = [];
  const omissions: string[] = [];
  let body = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  for (const { from, to } of override.source ?? []) {
    if (!body.includes(from))
      warnings.push(`source override not found: ${from}`);
    body = body.replaceAll(from, to);
  }
  const title = displayTitle(body, slug);
  const segments: SpokenSegment[] = [
    {
      role: "intro",
      text: `This is Frequency Music. Today's essay is ${endWithStop(title.replace(/:\s+/, " — "))}`,
    },
  ];
  const chapters: SpokenEssay["chapters"] = [
    { title: "Introduction", startParagraph: 0 },
  ];
  let pendingBreak = false;
  let skippingSection = false;
  let sectionNumber = 0;
  let sawTitle = false;
  let blockNumber = 0;

  const pushParagraph = (raw: string) => {
    const text = normalizeProse(raw);
    if (!text) return;
    segments.push({
      role: "paragraph",
      text: endWithStop(text),
      ...(pendingBreak ? { breakBefore: true } : {}),
    });
    pendingBreak = false;
  };

  const omit = (kind: "code" | "table", where: string) => {
    omissions.push(`${where}: ${kind === "code" ? "code listing" : "table"}`);
    segments.push({
      role: "paragraph",
      text: OMITTED[kind],
      breakBefore: true,
    });
    pendingBreak = true;
  };

  // Checks for text that will be narrated. Omitted blocks (code, tables,
  // citation sections, footers) are never checked, so their contents cannot
  // block an essay; narrated text holding math, unknown inline code, or
  // tag-like text waits for a spoken override.
  const checkNarrated = (text: string, where: string) => {
    // Math is never read automatically. Any "$" holds the essay for a
    // `source` override; inline spans, even ones wrapped across lines, carry
    // a suggested reading.
    if (text.includes("$")) {
      const spans = [...text.matchAll(/\$([^$]+)\$/g)];
      for (const math of spans) {
        warnings.push(
          `${where}: inline math needs a spoken override (suggestion: "${speakLatex(math[1]!.replaceAll(/\s+/g, " "))}"): $${math[1]}$`,
        );
      }
      if (spans.length === 0) {
        warnings.push(`${where}: a "$" needs a spoken override`);
      }
    }
    // Inline code is never unwrapped into narration unless it is one of the
    // forms the converter knows how to speak or drop.
    for (const span of text.matchAll(/`([^`]*)`/g)) {
      if (!SPEAKABLE_CODE.some((pattern) => pattern.test(span[1]!))) {
        warnings.push(
          `${where}: inline code needs a spoken override: \`${span[1]}\``,
        );
      }
    }
    // A plain-text equation ("3-2=1", "x^(n)y", "α=β=1.0") is math too: it
    // waits for a spoken override rather than an automatic reading.
    const bare = text
      .replaceAll(/https?:\/\/\S+/g, "")
      .replaceAll(/\$[^$]+\$/g, "")
      .replaceAll(/\[\^[^\]]+\]/g, "");
    if (/[=^]/.test(bare)) {
      const at = bare.search(/[=^]/);
      warnings.push(
        `${where}: plain-text math needs a spoken override near "${bare.slice(Math.max(0, at - 30), at + 30)}"`,
      );
    }
    const withoutAutolinks = text.replaceAll(/<https?:\/\/[^\s<>]+>/g, "");
    if (/<\/?[A-Za-z][^<>\n]*>/.test(withoutAutolinks)) {
      warnings.push(
        `${where}: tag-like text (HTML or a comparison) needs an override`,
      );
    }
  };

  // A paragraph's own text: footers, labels, and display math are decided
  // here; anything else is checked and narrated.
  const paragraph = (text: string, where: string) => {
    const trimmed = text.trim();
    // A bare "Sources:" label: the list after it is a citation list too.
    if (
      /^[_*]*(?:Sources?|References|Citations)\s*:?[_*]*\s*:?\s*$/i.test(
        trimmed,
      )
    ) {
      skippingSection = true;
      pendingBreak = true;
      return;
    }
    // Provenance footers and dateline stamps belong to the written page.
    if (
      /^[_*]*(?:Related|Sources?|Topics|Tags|Keywords)\s*:/i.test(trimmed) ||
      /^[_*]*Freq\s*[-–—]/.test(trimmed) ||
      /^[_*]*Essay #\d+\s*[-–—]/.test(trimmed)
    ) {
      pendingBreak = true;
      return;
    }
    if (trimmed.startsWith("$$")) {
      // Equations always get a human-written spoken form through a `source`
      // override; the automatic reading is only a suggestion.
      const tex = trimmed.replaceAll("$$", "").trim();
      warnings.push(
        `${where}: equation needs a spoken override (suggestion: "${speakLatex(tex)}"): ${tex}`,
      );
      segments.push({
        role: "paragraph",
        text: OMITTED.equation,
        breakBefore: true,
      });
      return;
    }
    checkNarrated(text, where);
    pushParagraph(text.replaceAll("\n", " "));
  };

  const walk = (tokens: Token[]) => {
    for (const token of tokens) {
      if (token.type === "space" || token.type === "def") continue;
      const where = `block ${++blockNumber}`;
      if (token.type === "heading") {
        const heading = token as Tokens.Heading;
        const name = cleanHeading(heading.text);
        if (heading.depth === 1 && !sawTitle) {
          sawTitle = true;
          checkNarrated(heading.text, where);
          continue;
        }
        // A citation heading at any level drops everything up to the next
        // heading or rule.
        skippingSection = DROPPED_SECTIONS.test(name);
        if (skippingSection) continue;
        checkNarrated(heading.text, where);
        if (heading.depth <= 2) {
          sectionNumber += 1;
          chapters.push({ title: name, startParagraph: segments.length });
          // A heading that numbers itself ("Part 1: Theory") keeps its own
          // number instead of gaining a second one.
          const numbered = name.match(
            /^((?:part|section|chapter)\s+\S+?)[:.]\s+(.+)$/i,
          );
          segments.push({
            role: "heading",
            text: numbered
              ? `${numbered[1]}. ${endWithStop(numbered[2]!)}`
              : `Part ${sectionOrdinal(sectionNumber)}. ${endWithStop(name)}`,
          });
        } else {
          segments.push({ role: "subheading", text: endWithStop(name) });
        }
        pendingBreak = false;
        continue;
      }
      // A rule ends a dropped citation section as well as marking a break.
      if (token.type === "hr") {
        skippingSection = false;
        pendingBreak = true;
        continue;
      }
      if (skippingSection) continue;
      if (token.type === "code") omit("code", where);
      else if (token.type === "table") omit("table", where);
      else if (token.type === "blockquote") {
        walk((token as Tokens.Blockquote).tokens);
      } else if (token.type === "list") {
        list(token as Tokens.List);
      } else if (token.type === "paragraph" || token.type === "text") {
        paragraph((token as Tokens.Paragraph).text, where);
      } else if (token.type === "html") {
        warnings.push(`${where}: an HTML block needs an override`);
      } else {
        warnings.push(
          `${where}: unsupported markdown (${token.type}) needs an override`,
        );
      }
    }
  };

  // Lists: each item is its own paragraph; ordered items are announced by
  // their number. Nested blocks inside an item are walked in order.
  const list = (token: Tokens.List) => {
    const start = typeof token.start === "number" ? token.start : 1;
    for (const [index, item] of token.items.entries()) {
      const ordinal = token.ordered
        ? (ORDINALS[start + index - 1] ?? `Number ${start + index}`)
        : undefined;
      let announced = false;
      for (const child of item.tokens) {
        if (
          !announced &&
          (child.type === "text" || child.type === "paragraph")
        ) {
          announced = true;
          const text = (child as Tokens.Text).text;
          paragraph(
            ordinal ? `${ordinal}: ${text}` : text,
            `block ${++blockNumber}`,
          );
        } else {
          walk([child]);
        }
      }
    }
  };

  walk(lex(body));

  segments.push({
    role: "outro",
    text: `That was ${endWithStop(shortTitle(title))} Thank you for listening to Frequency Music.`,
  });

  for (const [index, segment] of segments.entries()) {
    for (const { from, to } of override.replace ?? []) {
      segment.text = segment.text.replaceAll(from, to);
    }
    lint(segment.text, `segment ${index}`, warnings);
  }
  return { slug, title, segments, chapters, warnings, omissions };
}
