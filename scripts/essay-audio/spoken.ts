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

// Unit abbreviations read after "per" in a rate ("dB/Hz").
const RATE_UNITS = {
  kHz: "kilohertz",
  Hz: "hertz",
  ms: "millisecond",
  s: "second",
  sec: "second",
  min: "minute",
  hr: "hour",
  dB: "decibel",
  oct: "octave",
} as const;

// Full unit words read as "per" after a slash ("samples/second"); the
// abbreviations (s, sec, min, Hz, ...) are spelled out by RATE_UNITS.
const RATE_WORDS = [
  "second",
  "seconds",
  "minute",
  "minutes",
  "hour",
  "hours",
  "day",
  "days",
  "sample",
  "samples",
  "frame",
  "frames",
  "octave",
  "octaves",
  "beat",
  "beats",
  "bar",
  "bars",
  "cycle",
  "cycles",
  "word",
  "words",
  "token",
  "tokens",
  "step",
  "steps",
  "channel",
  "channels",
  "hertz",
  "watt",
  "watts",
  "volt",
  "volts",
  "decibel",
  "decibels",
  "cent",
  "cents",
  "meter",
  "meters",
  "metre",
  "metres",
  "gram",
  "grams",
  "bit",
  "bits",
  "byte",
  "bytes",
];
const RATE_AFTER_SLASH = new RegExp(
  `(?<=\\p{L})\\/(${RATE_WORDS.join("|")})\\b`,
  "gu",
);

// A plain numeric fraction. Before a duration or unit word ("1/2 beat",
// "3/4 bar", "5/2 seconds") a meter, ratio, and quantity look alike, so the
// slash is kept for the lint; so it is after a bare "in" ("in 7/8").
const FRACTION_FOLLOWERS = [
  ...RATE_WORDS,
  ...Object.keys(RATE_UNITS),
  "measure",
  "measures",
  "note",
  "notes",
  "pattern",
  "patterns",
  "grid",
  "grids",
];
// Unit matching is case-insensitive and any letter attached to the number
// (ASCII or not: "5/2μs") counts as a unit, so the slash is kept.
const FRACTION = new RegExp(
  `(?<![\\p{L}\\d_/.,])(?<!\\bin\\s+)(\\d+)\\/(\\d+)(?![\\p{L}\\d_/⁰-⁹¹²³⁻]|[.,]\\d|[\\s-]+(?:${FRACTION_FOLLOWERS.join("|")})\\b)`,
  "giu",
);

const DECIMAL_SCORE = new RegExp(
  `(?<![\\d./])(\\d+\\.\\d+)\\/(\\d+)(?![\\p{L}\\d_/⁰-⁹¹²³⁻]|[./]\\d|[\\s-]+(?:${FRACTION_FOLLOWERS.join("|")})\\b)`,
  "giu",
);

// Every arithmetic operator the normalizer speaks, for the gates below.
const OP = "[-–−+×*·÷±:/]";
const FRACTION_ARITHMETIC = new RegExp(
  `\\d\\/[\\d.]+\\s*${OP}\\s*\\d|\\d\\s*${OP}\\s*[\\d.]+\\/\\d`,
);
// A colon ratio joined to another number by a non-colon operator
// ("4:3–3:2"); a plain chain such as 4:5:6 is fine.
const RATIO_ARITHMETIC =
  /\d:[\d.]+\s*[-–−+×*·÷±/]\s*\d|\d\s*[-–−+×*·÷±/]\s*[\d.]+:\d/;
// Every run of numbers joined by operators, brackets included, must be one
// of the shapes the converter reads: a range (3-5, 3–5), a ratio chain
// (3:2, 4:5:6), a fraction (3/2), or a decimal score (4.22/5). Anything
// else ("1+(2-3)", "2 - 3", "1+2-3") waits for a spoken override.
const NUMBER = String.raw`\d+(?:[.,]\d+)*`;
const NUMERIC_EXPRESSION = new RegExp(
  // A colon followed by a space is prose punctuation ("k equals 7: 120").
  // Later operands may carry a sign ("2+(-3)"), which no readable shape has.
  String.raw`[([]*${NUMBER}[)\]]*(?:(?:\s*[-–−+×*·÷±/]\s*|:(?!\s))[([]*[-−]?${NUMBER}[)\]]*)+`,
  "g",
);
const READABLE_NUMERIC = [
  /^\d[\d.,]*(?:-|\s?–\s?)\d[\d.,]*$/,
  /^\d[\d.]*(?::\d[\d.]*)+$/,
  /^\d+\/\d+$/,
  /^\d+\.\d+\/\d+$/,
  /^\d+\s?×\s?\d+$/,
  /^\d+(?:\s?\+\s?\d+)+$/,
  /^\d[\d.]*\s?±\s?\d[\d.]*$/,
];

const POWERED_OPERAND = new RegExp(
  `[\\d.]\\s*${OP}\\s*\\d[\\d.,]*[⁰-⁹¹²³⁻]|[⁰-⁹¹²³⁻]\\s*${OP}\\s*[\\d.]`,
);

// One unit list for both rules: a unit word on either side of a slash is
// never read as an alternative ("8 bits/pixel" keeps its slash for the lint).
const UNIT_WORDS = new Set([
  ...RATE_WORDS,
  ...Object.keys(RATE_UNITS).map((unit) => unit.toLowerCase()),
  ...Object.values(RATE_UNITS).flatMap((unit) => [unit, `${unit}s`]),
  "mhz",
  "ghz",
  "dbfs",
  "dbtp",
  "lufs",
  "kbps",
  "mbps",
  "bpm",
  "rpm",
  "pixel",
  "pixels",
]);

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

  // Code spans lose their padding (` x . x ` is `x . x`), as the markdown
  // lexer that validates them does, so validation and speech agree.
  text = text.replaceAll(
    /`([^`]*)`/g,
    (_, code: string) => `\`${code.trim()}\``,
  );

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
    // Unicode-aware boundaries: intraword markers ("α*β*γ") are arithmetic
    // and stay for the lint.
    .replaceAll(
      /(?<![\p{L}\d_*])\*\*(?=\S)([^*]*?\S)\*\*(?![\p{L}\d_*])/gu,
      "$1",
    )
    .replaceAll(/(?<![\p{L}\d_])__(?=\S)([^_]*?\S)__(?![\p{L}\d_])/gu, "$1")
    .replaceAll(/(?<![\p{L}\d_*])\*(?=\S)([^*\n]*?\S)\*(?![\p{L}\d_*])/gu, "$1")
    .replaceAll(/(?<![\p{L}\d_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\d_])/gu, "$1");

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
    .replaceAll(RATE_AFTER_SLASH, " per $1")
    .replaceAll(/\band\/or\b/g, "and or")
    // A unit abbreviation after a slash is a rate too ("dB/Hz", "samples/ms").
    .replaceAll(
      /(?<=[\p{L}\d])\/(kHz|Hz|ms|s|sec|min|hr|dB|oct)\b/gu,
      (_, unit: keyof typeof RATE_UNITS) => ` per ${RATE_UNITS[unit]}`,
    )
    // A slash pair naming a ratio is "to" ("signal/noise ratio").
    .replaceAll(
      /\b([\p{L}][\p{L}\d-]*)\/([\p{L}][\p{L}\d-]*)(?=\s+ratios?\b)/gu,
      "$1-to-$2",
    )
    // A spaced slash between words separates phrases ("stable core /
    // adaptive surface"); "1 / 2" and "x / y" are division, and a unit on
    // either side ("samples / second") is a rate: both left for the lint.
    .replaceAll(
      /(\p{L}{2,})\s+\/\s+(\p{L}{2,})/gu,
      (match, left: string, right: string) =>
        UNIT_WORDS.has(left.toLowerCase()) ||
        UNIT_WORDS.has(right.toLowerCase())
          ? match
          : `${left}, ${right}`,
    )
    .replaceAll(/\bA\/B\/C\b/g, "A-B-C")
    .replaceAll(/\bA\/B\b/g, "A-B")
    .replaceAll(/\bI\/O\b/g, "I-O")
    // Plain words of three or more letters ("major/minor", "acoustic/
    // electronic") are alternatives. Anything else (x/y, MP3/OGG, a unit
    // left over) keeps its slash and is refused by the lint.
    .replaceAll(
      /(?<![\p{L}\d-])([\p{L}\d][\p{L}\d-]*)((?:\/[\p{L}\d][\p{L}\d-]*)+)/gu,
      (match, first: string, rest: string) => {
        const terms = [first, ...rest.slice(1).split("/")];
        const wordy = terms.every(
          (term) =>
            /^\p{L}[\p{L}-]{2,}$/u.test(term) &&
            !UNIT_WORDS.has(term.toLowerCase()),
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
    // A decimal score ("4.22/5"); before a unit word ("1.5/2 seconds") it
    // is a quantity, left for the lint like the fractions below.
    .replaceAll(DECIMAL_SCORE, "$1 out of $2");

  // Tuning-system shorthand.
  text = text
    .replaceAll(/\b(\d+)[- ]?(?:TET|tET|ET)\b/g, "$1-tone equal temperament")
    .replaceAll(/\b(\d+)[- ]?EDO\b/g, "$1 equal divisions of the octave")
    .replaceAll(/\b(\d+)[- ]?edo\b/g, "$1 equal divisions of the octave")
    .replaceAll(/\bTET\b/g, "equal temperament")
    .replaceAll(/\bEDOs\b/g, "equal divisions of the octave")
    .replaceAll(/\bEDO\b/g, "equal division of the octave");

  // Additive groupings ("3+3+2", "5 + 7") are spoken with "plus".
  text = text.replaceAll(/(?<=\d)\s?\+\s?(?=\d)/g, " plus ");

  // A sign before a number is spoken before any fraction is spelled out.
  text = text.replaceAll(/(^|[\s(["'“‘])[−-](?=\d)/g, "$1minus ");

  // Ranges, ratios, and fractions. Ranges first so "3–5" is not read as a
  // dash; ratios before fractions so "81:80" never reaches the slash rule.
  text = text
    // A hyphen or en dash between numbers is a range only when it ascends
    // (3-5, 0.09–0.57, 1995-2005); anything else ("5–3") is left for the
    // lint. A full stop after the range ends the sentence unless a digit
    // follows it.
    .replaceAll(
      /(?<![\w.,–-])(\d+(?:\.\d+)?)(?:-|\s?–\s?)(\d+(?:\.\d+)?)(?![.,]\d|[\w/–-]|:(?!\s|$))/g,
      (match, a: string, b: string) =>
        Number(a) < Number(b) ? `${a} to ${b}` : match,
    )
    .replaceAll(
      /(?<![\w:.])(\d+(?:\.\d+)?)((?::\d+(?:\.\d+)?)+)(?!\s?(?:am|pm|AM|PM)\b)(?![\w:⁰-⁹¹²³⁻])/g,
      (_, first: string, rest: string) =>
        [first, ...rest.slice(1).split(":")].join(" to "),
    )
    // Time signatures read as "4 4": after "Time:", or before a meter word. An equal pair with no such context
    // ("4/4") is left for the lint rather than read as "4 to 4", and so is
    // anything after a bare "in" ("in 7/8" is a meter, "in 1/2 of the
    // cases" is not), which the fraction rule below skips.
    .replaceAll(
      /(?<=\bTime:\s+)(\d{1,2})\/(2|4|8|16)\b(?![\w/.]|,\d)/g,
      "$1 $2",
    )
    .replaceAll(
      /(?<![\w/.])(\d{1,2})\/(2|4|8|16)(?=\s+(?:time|meter|metre|signature|groove|feel|timeline|waltz)\b)/g,
      "$1 $2",
    )
    .replaceAll(
      // A power on the denominator (2/3²) is not a plain fraction: left for
      // the lint rather than read as "two thirds squared".
      // Before a duration word ("1/2 beat", "3/4 bar") a meter and a
      // fraction look alike: left for the lint too.
      FRACTION,
      (match, a: string, b: string) => {
        const num = Number(a);
        const den = Number(b);
        if (num === den && num > 1 && [2, 4, 8, 16].includes(den)) return match;
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
    // Any other "+" is spoken ("body + space", "4,000+ scales", "C++");
    // numeric arithmetic was already refused by the narration checks.
    .replaceAll(/\s*\+\s*/g, " plus ")
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
  // A colon then a space is prose punctuation; an unspaced one is a ratio.
  [/\d\s*\/\s*\d|\d\s?:\d/, "unconverted ratio or fraction"],
  [/https?:|www\./, "URL"],
  [/[\u2070-\u209F]/u, "unconverted superscript or subscript"],
  [/\/|!(?=[=\w])/, "unconverted slash or operator"],
  [/\d\s?[-–]\s?\d/, "hyphen or dash between numbers"],
  // Any dash or minus still touching a number after conversion ("80–-60")
  // is notation the converter did not resolve.
  [/\d\s*[–−]|[–−]\s*\d|[-–−]\s*[-–−]\s*\d/, "dash or minus next to a number"],
  [/(^|[\s(["'“‘])-(?=[a-z])/, "sign or dash before a word"],
  [
    /[\u2100-\u214F\u2200-\u22FF\u27C0-\u27EF\u2980-\u2AFF]/u,
    "unconverted mathematical symbol",
  ],
  [/\b[0-9a-z]{24,}\b/, "opaque identifier"],
  [/&[A-Za-z][A-Za-z0-9]*;/, "HTML entity"],
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

// The inline text a listener hears, rendered from the markdown lexer's own
// tokens so validation and speech come from one parse: emphasis and links
// unwrapped to their text (reference links resolved by the lexer), images
// dropped, and each code span decided on its decoded content. Record ids
// are dropped, repository paths named, rhythm grids and bit strings spoken;
// any other code span is kept in backticks and reported in `unknownCode`.
function renderInline(tokens: Token[], unknownCode: string[]): string {
  const parts = tokens.map((token) => renderToken(token, unknownCode));
  // Intraword emphasis, pressed against a letter or digit on either side
  // ("2*3*4", "2*x*3", "x*y*z", "**2***3***4**"), is arithmetic the lexer
  // misread: keep it raw so the checks and the lint see the operators
  // instead of a fused "234" or "2x3".
  return parts
    .map((part, index) => {
      const token = tokens[index]!;
      if (token.type !== "em" && token.type !== "strong") return part;
      const intraword =
        /[\p{L}\d]$/u.test(parts[index - 1] ?? "") ||
        /^[\p{L}\d]/u.test(parts[index + 1] ?? "");
      return intraword ? token.raw : part;
    })
    .join("");
}

function renderToken(token: Token, unknownCode: string[]): string {
  switch (token.type) {
    case "image":
      return "";
    case "br":
      return " ";
    case "codespan":
      return speakCode((token as Tokens.Codespan).text, unknownCode);
    case "strong":
    case "em":
    case "del":
    case "link":
      return renderInline((token as Tokens.Strong).tokens, unknownCode);
    case "text": {
      const text = token as Tokens.Text;
      return text.tokens ? renderInline(text.tokens, unknownCode) : text.text;
    }
    default:
      return "text" in token ? String(token.text) : token.raw;
  }
}

function speakCode(code: string, unknownCode: string[]): string {
  const content = code.trim();
  if (/^(?:j[0-9a-z]|k[0-9a-z]|jx)[0-9a-z]{28,}$/.test(content)) return "";
  if (/^(?:data|docs|scripts|out)\//.test(content)) return "the project's data";
  if (/^[x.](?: [x.])+$/.test(content)) return speakRhythm(content);
  if (/^[01]{4,}$/.test(content)) {
    return content
      .split("")
      .map((bit) => (bit === "1" ? "one" : "zero"))
      .join(" ");
  }
  unknownCode.push(content);
  return `\`${content}\``;
}

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
  return heading
    ? cleanHeading(renderInline(heading.tokens, []))
    : slug.replaceAll("-", " ");
}

// The short title used in the intro, the outro, and the episode name: the
// part before a subtitle colon.
export function shortTitle(title: string): string {
  return title.split(/:\s/)[0] ?? title;
}

const SOURCES_LABEL =
  /^[_*]*(?:Sources?|References|Citations)\s*:?[_*]*\s*:?\s*$/i;

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
  // `spoken` is renderInline's output (what will be heard): inline
  // formatting unwrapped ("**1**+**2**" is "1+2"), images and link
  // destinations gone. Bare URLs are dropped by normalizeProse, so they are
  // not checked either.
  const checkNarrated = (
    spoken: string,
    where: string,
    unknownCode: string[],
  ) => {
    const text = spoken.replaceAll(/https?:\/\/\S+/g, "");
    for (const code of unknownCode) {
      warnings.push(
        `${where}: inline code needs a spoken override: \`${code}\``,
      );
    }
    // A root before a number ("√2/3") has an operand scope the converter
    // cannot read; "√x" is spoken.
    if (/√\s*[\d([]/.test(text)) {
      warnings.push(`${where}: a root of a number needs a spoken override`);
    }
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
    // A numeric power ("10²", "(2-3)²", "3²/2³") has an operator scope no
    // automatic reading can be trusted with; letter powers ("r²") are fine.
    if (/[\d)\]][⁰-⁹¹²³⁻]/.test(text)) {
      warnings.push(`${where}: a numeric power needs a spoken override`);
    }
    // A clock-shaped pair ("0:36") or a colon pair after a time word
    // ("At 12:34", "from 10:15") is a timestamp, not a ratio.
    if (
      /(?<![\d:.])\d:\d\d(?![\d:])/.test(text) ||
      /\b(?:at|from|until|till|by|around|after|before|between|timestamps?(?:\s+(?:is|of|at))?|time(?:\s+(?:is|of))?)\s+\d{1,2}:\d\d\b/i.test(
        text,
      ) ||
      // A clock-shaped hh:mm:ss chain (hour up to 23, then two-digit minutes
      // and seconds under 60) reads as a time, not a three-part ratio.
      /(?<![\d:.])(?:[01]?\d|2[0-3]):[0-5]\d:[0-5]\d(?![\d:])/.test(text)
    ) {
      warnings.push(
        `${where}: a timestamp-like "d:dd" needs a spoken override`,
      );
    }
    // Arithmetic with a fraction or ratio operand ("1/2-1/3", "3 + 1/4",
    // "4:3–3:2") has no reading the converter can be trusted with.
    for (const expression of text.matchAll(NUMERIC_EXPRESSION)) {
      // Brackets around the whole run are prose ("(3:2)"); a bracket inside
      // it is grouping ("1+(2-3)") and is never readable.
      const span = expression[0].trim().replaceAll(/^[([]+|[)\]]+$/g, "");
      if (
        /[()[\]]/.test(span) ||
        !READABLE_NUMERIC.some((shape) => shape.test(span))
      ) {
        warnings.push(
          `${where}: numeric expression "${span}" needs a spoken override`,
        );
      }
    }
    if (FRACTION_ARITHMETIC.test(text) || RATIO_ARITHMETIC.test(text)) {
      warnings.push(
        `${where}: arithmetic with a fraction needs a spoken override`,
      );
    }
    // A powered number beside an operator ("2-3²", "2/3²", "10²×4") has an
    // operator scope no automatic reading can be trusted with.
    if (POWERED_OPERAND.test(text)) {
      warnings.push(
        `${where}: a powered number beside an operator needs a spoken override`,
      );
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
  const paragraph = (
    text: string,
    tokens: Token[],
    where: string,
    ordinal?: string,
  ) => {
    const trimmed = text.trim();
    // A bare "Sources:" label: the list after it is a citation list too.
    if (SOURCES_LABEL.test(trimmed)) {
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
    const unknownCode: string[] = [];
    const spoken = renderInline(tokens, unknownCode).replaceAll("\n", " ");
    checkNarrated(spoken, where, unknownCode);
    // A list item's spoken ordinal is added only after the label checks, so
    // "1. Sources:" is still recognized.
    pushParagraph(ordinal ? `${ordinal}: ${spoken}` : spoken);
  };

  const walk = (tokens: Token[]) => {
    for (const token of tokens) {
      if (token.type === "space" || token.type === "def") continue;
      const where = `block ${++blockNumber}`;
      if (token.type === "heading") {
        const heading = token as Tokens.Heading;
        const headingCode: string[] = [];
        const headingText = renderInline(heading.tokens, headingCode);
        const name = cleanHeading(headingText);
        if (heading.depth === 1 && !sawTitle) {
          sawTitle = true;
          checkNarrated(headingText, where, headingCode);
          continue;
        }
        // A citation heading at any level drops everything up to the next
        // heading or rule.
        skippingSection = DROPPED_SECTIONS.test(name);
        if (skippingSection) continue;
        checkNarrated(headingText, where, headingCode);
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
        const block = token as Tokens.Paragraph;
        paragraph(block.text, block.tokens, where);
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
      // A "Sources:" item drops the citation items after it.
      if (skippingSection) return;
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
          const text = child as Tokens.Text;
          paragraph(
            text.text,
            text.tokens ?? Lexer.lexInline(text.text),
            `block ${++blockNumber}`,
            ordinal,
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
