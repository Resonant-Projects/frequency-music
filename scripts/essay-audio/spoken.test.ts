import { describe, expect, test } from "vite-plus/test";
import { normalizeProse, speakLatex, toSpokenEssay } from "./spoken";
import { wordErrorRate } from "./wer";

describe("normalizeProse", () => {
  test("ratios, fractions, and tuning shorthand become speech", () => {
    expect(
      normalizeProse(
        "Every interval: 3/2 for a fifth, 5:4 for a third, 81:80 comma.",
      ),
    ).toBe(
      "Every interval: 3 to 2 for a fifth, 5 to 4 for a third, 81 to 80 comma.",
    );
    expect(normalizeProse("about 1/3 of the octave")).toBe(
      "about one third of the octave",
    );
    expect(normalizeProse("a 4:5:6 triad in 7/8 time")).toBe(
      "a 4 to 5 to 6 triad in 7 8 time",
    );
    expect(normalizeProse("12-TET and 31-EDO")).toBe(
      "12-tone equal temperament and 31 equal divisions of the octave",
    );
    expect(normalizeProse("a 1,536 kbps stream at 44.1 kHz")).toBe(
      "a 1,536 kilobits per second stream at 44.1 kilohertz",
    );
    expect(normalizeProse("primes (2, 3, 5, 7, ...)")).toBe(
      "primes (2, 3, 5, 7, and so on)",
    );
    expect(normalizeProse("C# major vs. F♭")).toBe(
      "C sharp major versus F flat",
    );
  });

  test("record ids, citations, and links are not read aloud", () => {
    expect(
      normalizeProse(
        "SR-CorrNet speech separation (`j9707xjeskqasppyj6nw1v99vs86sw9a`) shows it [S2].",
      ),
    ).toBe("SR-CorrNet speech separation shows it.");
    expect(
      normalizeProse(
        "See [The Comma Problem](the-comma-problem.md) and https://example.com/x.",
      ),
    ).toBe("See The Comma Problem and.");
    expect(normalizeProse("The Dominant Channel (#64) and #82 asked")).toBe(
      "The Dominant Channel and essay 82 asked",
    );
  });

  test("emphasis, symbols, and powers", () => {
    expect(normalizeProse("**bold** and _italic_ x → y ≈ 2² and 2¹⁶")).toBe(
      "bold and italic x to y approximately 2 squared and 2 to the 16",
    );
    expect(normalizeProse("p < 0.01, A=432 Hz, -16 LUFS")).toBe(
      "p less than 0.01, A equals 432 hertz, minus 16 L U F S",
    );
    expect(normalizeProse("a rhythm `x . . x . x .`")).toBe(
      "a rhythm hit, rest, rest, hit, rest, hit, rest",
    );
  });
});

describe("speakLatex", () => {
  test("fractions, powers, and roots", () => {
    expect(speakLatex("M_A = \\frac{a + b}{2}")).toBe(
      "M sub A equals a plus b over 2",
    );
    expect(speakLatex("M_G = \\sqrt{ab}")).toBe(
      "M sub G equals the square root of ab",
    );
    expect(speakLatex("S(f) \\propto \\frac{1}{f^\\beta}")).toBe(
      "S(f) is proportional to 1 over f to the power beta",
    );
  });
});

const ESSAY = `# The Tuning Codec: Temperament as Lossy Compression

_Every tuning system is a codec._

---

## Two Problems, One Shape

In "The Comma Problem," we explored it — the gap.

It generates specific insights:

1. **First point.** Detail one.

2. **Second point.** Detail two.

| a | b |
|---|---|
| 1 | 2 |

### A Subsection

Closing thought.

## Sources

- Some paper (\`j9707xjeskqasppyj6nw1v99vs86sw9a\`)

---

_The Pythagorean comma is 23.46 cents._

_Related: [The Comma Problem](the-comma-problem.md)_
`;

describe("toSpokenEssay", () => {
  const essay = toSpokenEssay("the-tuning-codec", ESSAY);

  test("announces the essay and numbers its sections", () => {
    expect(essay.title).toBe(
      "The Tuning Codec: Temperament as Lossy Compression",
    );
    expect(essay.segments[0]).toEqual({
      role: "intro",
      text: "This is Frequency Music. Today's essay is The Tuning Codec — Temperament as Lossy Compression.",
    });
    const heading = essay.segments.find((s) => s.role === "heading");
    expect(heading?.text).toBe("Part one. Two Problems, One Shape.");
    expect(essay.segments.at(-1)).toEqual({
      role: "outro",
      text: "That was The Tuning Codec. Thank you for listening to Frequency Music.",
    });
    expect(essay.chapters).toEqual([
      { title: "Introduction", startParagraph: 0 },
      { title: "Two Problems, One Shape", startParagraph: 2 },
    ]);
  });

  test("ordered list items keep their numbers across blank lines", () => {
    const texts = essay.segments.map((s) => s.text);
    expect(texts).toContain("First: First point. Detail one.");
    expect(texts).toContain("Second: Second point. Detail two.");
    expect(texts).toContain("It generates specific insights.");
  });

  test("tables are announced, citation sections and footers dropped", () => {
    const texts = essay.segments.map((s) => s.text).join("\n");
    expect(texts).toContain("includes a table here");
    expect(texts).not.toContain("Some paper");
    expect(texts).not.toContain("Related");
    expect(texts).toContain("The Pythagorean comma is 23.46 cents.");
    expect(essay.segments.find((s) => s.role === "subheading")?.text).toBe(
      "A Subsection.",
    );
    const closing = essay.segments.find((s) =>
      s.text.startsWith("The Pythagorean"),
    );
    expect(closing?.breakBefore).toBe(true);
    expect(essay.warnings).toEqual([]);
  });

  test("residue is reported and an override can clear it", () => {
    const markdown = "# T\n\nWorking in ℤ[i] gives closure.\n";
    expect(toSpokenEssay("t", markdown).warnings.length).toBeGreaterThan(0);
    const fixed = toSpokenEssay("t", markdown, {
      replace: [{ from: "ℤ[i]", to: "the Gaussian integers" }],
    });
    expect(fixed.warnings).toEqual([]);
    expect(fixed.segments[1]?.text).toBe(
      "Working in the Gaussian integers gives closure.",
    );
  });
});

describe("wordErrorRate", () => {
  test("counts substitutions, insertions, and deletions per reference word", () => {
    expect(
      wordErrorRate("the ear is the critic", "the ear is the critic"),
    ).toBe(0);
    expect(
      wordErrorRate("the ear is the critic", "the year is critic"),
    ).toBeCloseTo(0.4);
  });
});

describe("headings and stops", () => {
  test("a self-numbered heading keeps its number; parentheses still get a stop", () => {
    const essay = toSpokenEssay(
      "x",
      "# X\n\n## Part 1: Theory\n\nText (in brackets)\n\n## Method\n\nMore.\n",
    );
    const texts = essay.segments.map((s) => s.text);
    expect(texts).toContain("Part 1. Theory.");
    expect(texts).toContain("Text (in brackets).");
    expect(texts).toContain("Part two. Method.");
  });
});

describe("review regressions", () => {
  test("exponents keep every digit; braced powers substitute", () => {
    expect(speakLatex("2^20")).toBe("2 to the power 20");
    expect(speakLatex("x^{n}")).toBe("x to the power n");
    expect(speakLatex("x^2 + y^{3}")).toBe("x squared plus y cubed");
  });

  test("inline math comparisons survive HTML stripping", () => {
    expect(normalizeProse("when $x<y>z$ holds")).toBe(
      "when x less than y greater than z holds",
    );
    expect(normalizeProse("the sum $f_n$ and $M_A$")).toBe(
      "the sum f sub n and M sub A",
    );
  });

  test("a source override gives a display equation a spoken form", () => {
    const markdown =
      "# T\n\nThe wave equation:\n\n$$\n\\mathbb{R}^n\n$$\n\nDone.\n";
    expect(toSpokenEssay("t", markdown).warnings.length).toBeGreaterThan(0);
    const fixed = toSpokenEssay("t", markdown, {
      source: [
        {
          from: "$$\n\\mathbb{R}^n\n$$",
          to: "That is, n-dimensional real space.",
        },
      ],
    });
    expect(fixed.warnings).toEqual([]);
    expect(fixed.segments.map((s) => s.text)).toContain(
      "That is, n-dimensional real space.",
    );
    const missing = toSpokenEssay("t", markdown, {
      source: [{ from: "nope", to: "x" }],
    });
    expect(missing.warnings.some((w) => w.includes("not found"))).toBe(true);
  });

  test("a bare Sources label drops the list that follows it", () => {
    const essay = toSpokenEssay(
      "t",
      "# T\n\nBody.\n\n**Sources:**\n\n- A paper (2022)\n- Another\n\n---\n\n_Coda._\n\n**Topics:** a, b\n",
    );
    const texts = essay.segments.map((s) => s.text).join("\n");
    expect(texts).not.toContain("paper");
    expect(texts).not.toContain("Topics");
    expect(texts).toContain("Coda.");
  });
});

describe("review round 2 regressions", () => {
  test("bare inequalities in prose are spoken, real tags removed", () => {
    expect(normalizeProse("x<y>z")).toBe("x less than y greater than z");
    expect(normalizeProse("0<x<1 and y>0")).toBe(
      "0 less than x less than 1 and y greater than 0",
    );
    expect(normalizeProse("x<a>b")).toBe("x less than a greater than b");
    expect(
      toSpokenEssay("t", "# T\n\nWhen x<a>b holds.\n").warnings.length,
    ).toBe(1);
  });

  test("unsupported Unicode mathematics is reported", () => {
    const essay = toSpokenEssay("t", "# T\n\nLet x ∈ ℝ.\n");
    expect(essay.warnings.some((w) => w.includes("mathematical symbol"))).toBe(
      true,
    );
  });
});

describe("review round 3 regressions", () => {
  test("decimal fractions are not partially converted", () => {
    expect(normalizeProse("a ratio of 1/2.5")).not.toContain("half");
    expect(
      toSpokenEssay("t", "# T\n\nA ratio of 1/2.5 here.\n").warnings.length,
    ).toBeGreaterThan(0);
  });

  test("a citation subheading drops its list", () => {
    const essay = toSpokenEssay(
      "t",
      "# T\n\n## Body\n\nText.\n\n### References\n\n- A paper\n\n## Next\n\nMore.\n",
    );
    const texts = essay.segments.map((s) => s.text).join("\n");
    expect(texts).not.toContain("References");
    expect(texts).not.toContain("paper");
    expect(texts).toContain("More.");
  });
});

describe("word slashes", () => {
  test("alternatives are read with or", () => {
    expect(normalizeProse("major/minor and real/synthetic, and/or both")).toBe(
      "major or minor and real or synthetic, and or both",
    );
  });
});

describe("review round 5 regressions", () => {
  test("bracketed numbers are kept for the lint, not deleted", () => {
    expect(normalizeProse("The chord is $[0,4,7]$.")).toBe(
      "The chord is [0,4,7].",
    );
    expect(
      toSpokenEssay("t", "# T\n\nThe chord is [0, 4, 7].\n").warnings.length,
    ).toBeGreaterThan(0);
  });

  test("rate units read as per", () => {
    expect(normalizeProse("48000 samples/second at 16 bits/sample")).toBe(
      "48000 samples per second at 16 bits per sample",
    );
  });

  test("a source override reaches the spoken title", () => {
    const essay = toSpokenEssay("t", "# On ℤ\n\nBody.\n", {
      source: [{ from: "ℤ", to: "the Integers" }],
    });
    expect(essay.warnings).toEqual([]);
    expect(essay.segments[0]?.text).toContain("On the Integers");
  });
});

describe("review round 6 regressions", () => {
  test("multiplication in math is spoken; emphasis still stripped", () => {
    expect(normalizeProse("The product is $2 * 3 * 4$.")).toBe(
      "The product is 2 times 3 times 4.",
    );
    expect(normalizeProse("a 2 * 3 grid")).toBe("a 2 * 3 grid");
    expect(normalizeProse("*really* and _so_")).toBe("really and so");
  });

  test("arrow commands keep their direction", () => {
    expect(speakLatex("x \\leftarrow y")).toBe("x from y");
    expect(speakLatex("x \\rightarrow y")).toBe("x to y");
    expect(speakLatex("\\left( x \\right)")).toBe("( x )");
  });

  test("signs survive fraction spelling and signed exponents", () => {
    expect(normalizeProse("A coefficient of -1/2.")).toBe(
      "A coefficient of minus one half.",
    );
    expect(normalizeProse("about 10⁻² of it")).toBe(
      "about 10 to the minus 2 of it",
    );
  });

  test("autolinks are removed without a tag warning", () => {
    const essay = toSpokenEssay("t", "# T\n\nSee <https://example.com> now.\n");
    expect(essay.warnings).toEqual([]);
    expect(essay.segments[1]?.text).toBe("See now.");
  });
});

describe("review round 7 regressions", () => {
  test("single-letter division is refused, not read as alternatives", () => {
    expect(normalizeProse("the ratio x/y")).toBe("the ratio x/y");
    expect(
      toSpokenEssay("t", "# T\n\nThe ratio x/y grows.\n").warnings.length,
    ).toBeGreaterThan(0);
  });

  test("compound comparisons are spoken whole", () => {
    expect(normalizeProse("when x!=y and a<=b and c>=d")).toBe(
      "when x is not equal to y and a is at most b and c is at least d",
    );
    expect(speakLatex("x \\ne y")).toBe("x is not equal to y");
  });

  test("an indented code block gets the spoken notice", () => {
    const essay = toSpokenEssay(
      "t",
      "# T\n\nBefore.\n\n    const x = 1;\n    const y = 2;\n\nAfter.\n",
    );
    const texts = essay.segments.map((s) => s.text);
    expect(texts).toContain(
      "The written essay includes a code listing here; it is left out of the audio edition.",
    );
    expect(texts).toContain("After.");
    expect(essay.omissions.length).toBe(1);
  });
});

describe("benign slashes", () => {
  test("phrase separators, A/B, and alphanumeric pairs", () => {
    expect(normalizeProse("Stable core / adaptive surface")).toBe(
      "Stable core, adaptive surface",
    );
    expect(normalizeProse("an A/B test and an A/B/C study over I/O")).toBe(
      "an A-B test and an A-B-C study over I-O",
    );
    expect(
      normalizeProse("2-note/2-chord blocks, MP3/OGG, F0/F2/intensity"),
    ).toBe("2-note or 2-chord blocks, MP3 or OGG, F0 or F2 or intensity");
    expect(normalizeProse("a 24-bit/96 kHz file")).toBe(
      "a 24-bit/96 kilohertz file",
    );
  });
});

describe("review round 8 regressions", () => {
  test("spaced division is left for the lint", () => {
    expect(normalizeProse("so 1 / 2 and x / y")).toBe("so 1 / 2 and x / y");
    expect(
      toSpokenEssay("t", "# T\n\nSo 1 / 2 here.\n").warnings.length,
    ).toBeGreaterThan(0);
  });

  test("LaTeX commands match whole", () => {
    expect(speakLatex("1 + 2 + \\cdots + n")).toBe(
      "1 plus 2 plus and so on plus n",
    );
    expect(speakLatex("\\lnot p")).toContain("\\lnot");
  });

  test("an indented fence still gets the code notice", () => {
    const essay = toSpokenEssay(
      "t",
      "# T\n\nBefore.\n\n  ```\n  const n = 1;\n  ```\n\nAfter.\n",
    );
    const texts = essay.segments.map((s) => s.text).join("\n");
    expect(texts).toContain("includes a code listing here");
    expect(texts).not.toContain("const n");
  });
});

describe("review round 9 regressions", () => {
  test("expansions keep token boundaries; mixed numbers read with and", () => {
    expect(speakLatex("3\\frac{1}{2}")).toBe("3 and 1 over 2");
    expect(speakLatex("x^{2}y")).toBe("x squared y");
    expect(speakLatex("2^{n}m")).toBe("2 to the power n m");
  });
});

describe("review round 10 regressions", () => {
  test("only numeric fractions make mixed numbers; subscripts keep boundaries", () => {
    expect(speakLatex("2\\frac{x}{y}")).toBe("2 x over y");
    expect(speakLatex("x_{n}y")).toBe("x sub n y");
    expect(speakLatex("x_ny")).toBe("x sub n y");
  });
});

describe("review round 11 regressions", () => {
  test("Greek names and Unicode powers keep token boundaries", () => {
    expect(speakLatex("\\alpha\\beta")).toBe("alpha beta");
    expect(normalizeProse("so x²y and H₂O")).toBe("so x squared y and H 2 O");
  });
});

describe("math always waits for a human spoken form", () => {
  test("inline and display LaTeX are refused with a suggestion", () => {
    const inline = toSpokenEssay("t", "# T\n\nLet $x^ny$ and $2 ** 3$.\n");
    expect(inline.warnings.length).toBe(2);
    expect(inline.warnings[0]).toContain('suggestion: "x to the power ny"');
    const display = toSpokenEssay("t", "# T\n\n$$\na = b\n$$\n");
    expect(display.warnings[0]).toContain('suggestion: "a equals b"');
    const fixed = toSpokenEssay("t", "# T\n\nLet $x^ny$ hold.\n", {
      source: [{ from: "$x^ny$", to: "x to the n, times y," }],
    });
    expect(fixed.warnings).toEqual([]);
  });

  test("strong-emphasis markers must hug their text; roots are padded", () => {
    expect(normalizeProse("2 ** 3 ** 4 and **bold**")).toBe(
      "2 ** 3 ** 4 and bold",
    );
    expect(normalizeProse("a√b")).toBe("a the square root of b");
  });
});

describe("review round 13 regressions", () => {
  test("inline math wrapped across lines is still refused", () => {
    const essay = toSpokenEssay("t", "# T\n\nLet $x^ny\nand z$ hold.\n");
    expect(essay.warnings.length).toBe(1);
    expect(essay.warnings[0]).toContain("inline math");
    // "+ z$" at a line start opens a list (CommonMark); still refused.
    const listed = toSpokenEssay("t", "# T\n\nLet $x^ny\n+ z$ hold.\n");
    expect(listed.warnings.length).toBeGreaterThan(0);
  });

  test("dollar signs inside code listings do not block the essay", () => {
    const fenced = toSpokenEssay(
      "t",
      "# T\n\n```js\nconst s = `${x} ${y}`;\n```\n\nAfter.\n",
    );
    expect(fenced.warnings).toEqual([]);
    const indented = toSpokenEssay("t", "# T\n\n    echo $HOME\n\nAfter.\n");
    expect(indented.warnings).toEqual([]);
  });

  test("a lone dollar sign in prose is refused", () => {
    expect(
      toSpokenEssay("t", "# T\n\nIt cost $5 to run.\n").warnings.length,
    ).toBeGreaterThan(0);
  });
});

describe("review round 14 regressions", () => {
  test("a four-space-indented list marker is code (CommonMark), omitted unread", () => {
    const essay = toSpokenEssay("t", "# T\n\n    - Let $x^ny$ hold.\n");
    expect(essay.warnings).toEqual([]);
    expect(essay.omissions.length).toBe(1);
    const nested = toSpokenEssay(
      "t",
      "# T\n\n- Item\n\n    - Let $x^ny$ hold.\n",
    );
    expect(nested.warnings.some((w) => w.includes("inline math"))).toBe(true);
  });

  test("tag-like text inside an omitted indented listing is not checked", () => {
    const essay = toSpokenEssay(
      "t",
      "# T\n\n    const values: Array<T> = [];\n\nAfter.\n",
    );
    expect(essay.warnings).toEqual([]);
    expect(essay.omissions.length).toBe(1);
  });
});

describe("review round 15 regressions", () => {
  test("a heading-like line inside indented code stays in the listing", () => {
    const essay = toSpokenEssay(
      "t",
      "# T\n\nBefore.\n\n    ## Example $x$\n    echo hello\n\nAfter.\n",
    );
    expect(essay.warnings).toEqual([]);
    expect(essay.chapters.length).toBe(1);
    expect(essay.omissions.length).toBe(1);
  });
});

describe("review round 16 regressions", () => {
  test("a four-space-indented fence does not swallow the essay", () => {
    const essay = toSpokenEssay(
      "t",
      "# T\n\n    ```\n\nAfter the listing.\n\n## Next\n\nMore.\n",
    );
    const texts = essay.segments.map((s) => s.text);
    expect(texts).toContain("After the listing.");
    expect(texts).toContain("More.");
  });

  test("plain-text equations are refused for an override", () => {
    expect(
      toSpokenEssay("t", "# T\n\nThe difference is 3-2=1.\n").warnings.length,
    ).toBeGreaterThan(0);
    expect(
      toSpokenEssay("t", "# T\n\nGrows as x^(n)y here.\n").warnings.length,
    ).toBeGreaterThan(0);
    expect(
      toSpokenEssay("t", "# T\n\nSee https://example.com/?a=b for it.\n")
        .warnings,
    ).toEqual([]);
  });

  test("only ascending numeric hyphens are ranges", () => {
    expect(normalizeProse("3-5 cents, 1995-2005")).toBe(
      "3 to 5 cents, 1995 to 2005",
    );
    expect(
      toSpokenEssay("t", "# T\n\nThe span 5-3 shrinks.\n").warnings.length,
    ).toBeGreaterThan(0);
  });
});

describe("review round 17 regressions", () => {
  test("exponentiation is never read as bold", () => {
    expect(
      toSpokenEssay("t", "# T\n\nThe value is `2**3**4`.\n").warnings.length,
    ).toBeGreaterThan(0);
    expect(normalizeProse("so 2**3**4 holds")).toBe("so 2**3**4 holds");
    expect(normalizeProse("a **bold** word")).toBe("a bold word");
  });

  test("chained decimal division is left for the lint", () => {
    expect(normalizeProse("rated 4.22/5 overall")).toBe(
      "rated 4.22 out of 5 overall",
    );
    expect(
      toSpokenEssay("t", "# T\n\nThen 1.5/2/3 holds.\n").warnings.length,
    ).toBeGreaterThan(0);
  });

  test("footnote markers do not trip the equation gate", () => {
    const essay = toSpokenEssay("t", "# T\n\nA useful result.[^1]\n");
    expect(essay.warnings).toEqual([]);
    expect(essay.segments[1]?.text).toBe("A useful result.");
  });
});

describe("review round 18 regressions", () => {
  test("grouped numbers are not partially converted as fractions", () => {
    expect(normalizeProse("1/2,000 of the time")).not.toContain("half");
    expect(
      toSpokenEssay("t", "# T\n\nAbout 1/2,000 of the time.\n").warnings.length,
    ).toBeGreaterThan(0);
  });

  test("math in omitted content does not block the essay", () => {
    const essay = toSpokenEssay(
      "t",
      "# T\n\nBody.\n\n| a | $x^2$ |\n|---|---|\n| 1 | 2 |\n\n## Sources\n\n- Paper on $x^2$ = y\n",
    );
    expect(essay.warnings).toEqual([]);
    expect(essay.omissions.length).toBe(1);
  });
});

describe("review round 19 regressions", () => {
  test("only known inline code forms are read without an override", () => {
    expect(
      toSpokenEssay("t", "# T\n\nCompute `2-3` now.\n").warnings.length,
    ).toBeGreaterThan(0);
    expect(
      toSpokenEssay("t", "# T\n\nUse `numerator/denominator` here.\n").warnings
        .length,
    ).toBeGreaterThan(0);
    expect(
      toSpokenEssay(
        "t",
        "# T\n\nA grid `x . . x` and an id (`j9707xjeskqasppyj6nw1v99vs86sw9a`).\n",
      ).warnings,
    ).toEqual([]);
  });

  test("a longer fence is not closed by an inner shorter fence", () => {
    const essay = toSpokenEssay(
      "t",
      '# T\n\n````md\n```\nconsole.log("hello");\n```\n````\n\nAfter.\n',
    );
    const texts = essay.segments.map((s) => s.text).join("\n");
    expect(texts).not.toContain("console");
    expect(texts).toContain("After.");
    expect(essay.omissions.length).toBe(1);
  });
});

describe("review round 20 regressions", () => {
  test("tilde fences and indented code followed by prose are omitted", () => {
    const tilde = toSpokenEssay(
      "t",
      "# T\n\n~~~python\nprint('hello')\n~~~\n\nAfter.\n",
    );
    expect(tilde.segments.map((s) => s.text).join(" ")).not.toContain("print");
    expect(tilde.omissions.length).toBe(1);
    const indented = toSpokenEssay(
      "t",
      "# T\n\n    echo hello\nAfter the example.\n",
    );
    const texts = indented.segments.map((s) => s.text);
    expect(texts.join(" ")).not.toContain("echo");
    expect(texts).toContain("After the example.");
  });

  test("grouped numbers are never split into a range", () => {
    expect(
      toSpokenEssay("t", "# T\n\nThe difference is 2,000-1,000.\n").warnings
        .length,
    ).toBeGreaterThan(0);
    expect(normalizeProse("from 1,000-2,000 hertz")).not.toContain(" to 2");
  });
});

describe("review round 21 regressions", () => {
  test("a slash pair naming a ratio reads as to", () => {
    expect(normalizeProse("the signal/noise ratio and major/minor keys")).toBe(
      "the signal-to-noise ratio and major or minor keys",
    );
  });

  test("ordered items past ten keep their number", () => {
    const essay = toSpokenEssay(
      "t",
      "# T\n\n11. Eleventh point.\n12. Twelfth point.\n",
    );
    const texts = essay.segments.map((s) => s.text);
    expect(texts).toContain("Number 11: Eleventh point.");
    expect(texts).toContain("Number 12: Twelfth point.");
  });
});

describe("review round 22 regressions", () => {
  test("a decimal at the start of a heading keeps its value", () => {
    const essay = toSpokenEssay(
      "t",
      "# 0.5 Seconds of Silence\n\n## 2. Method\n\nText.\n",
    );
    expect(essay.title).toBe("0.5 Seconds of Silence");
    expect(essay.chapters[1]?.title).toBe("Method");
  });
});

describe("review round 23 regressions", () => {
  test("a power on the denominator is not read as a plain fraction", () => {
    expect(normalizeProse("The factor is 2/3².")).not.toContain("thirds");
    expect(
      toSpokenEssay("t", "# T\n\nThe factor is 2/3².\n").warnings.length,
    ).toBeGreaterThan(0);
  });
});
