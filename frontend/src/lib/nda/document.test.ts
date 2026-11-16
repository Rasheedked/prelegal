import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  COVER_PAGE_SECTIONS,
  buildNdaDocument,
  defaultFormValues,
  findUnsupportedCharacters,
  formatDate,
  formatYears,
  getMissingFields,
  pdfFileName,
} from "./document";
import { parseInline, parseNdaTemplate } from "./template";
import type { Block, Inline, NdaFormValues } from "./types";

// Tests run against the real Common Paper templates so that a template change
// the app cannot handle is caught here.
const read = (file: string) =>
  readFileSync(path.join(__dirname, "../../../../templates", file), "utf8");
const template = parseNdaTemplate({
  coverPage: read("Mutual-NDA-coverpage.md"),
  standardTerms: read("Mutual-NDA.md"),
});

const completeValues: NdaFormValues = {
  ...defaultFormValues(new Date(2026, 10, 14)),
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  parties: [
    { company: "Acme, Inc.", name: "Ada Lovelace", title: "CEO", noticeAddress: "ada@acme.test" },
    { company: "Globex LLC", name: "Alan Turing", title: "CTO", noticeAddress: "1 Main St" },
  ],
};

const text = (content: Inline[]) => content.map((run) => run.text).join("");

/** The plain text of the blocks that follow a level 3 heading, up to the next heading. */
function sectionText(blocks: Block[], heading: string): string[] {
  const start = blocks.findIndex((block) => block.type === "heading" && block.text === heading);
  expect(start, `section "${heading}"`).toBeGreaterThanOrEqual(0);
  const lines: string[] = [];
  for (const block of blocks.slice(start + 1)) {
    if (block.type === "heading") break;
    if (block.type === "paragraph") lines.push(text(block.content));
    if (block.type === "options") {
      lines.push(...block.options.map((o) => `${o.checked ? "[x]" : "[ ]"} ${text(o.content)}`));
    }
  }
  return lines;
}

describe("parseInline", () => {
  it("handles bold, links and cover page terms", () => {
    expect(
      parseInline('the **Bold** <span class="coverpage_link">Purpose</span> [link](https://x.test).'),
    ).toEqual([
      { text: "the " },
      { text: "Bold", bold: true },
      { text: " " },
      { text: "Purpose" },
      { text: " " },
      { text: "link", href: "https://x.test" },
      { text: "." },
    ]);
  });
});

describe("parseNdaTemplate", () => {
  it("finds every cover page section the app fills in", () => {
    expect(template.coverPage.sections.map((section) => section.heading)).toEqual(
      COVER_PAGE_SECTIONS,
    );
  });

  it("reads the signature table", () => {
    expect(template.coverPage.partyLabels).toEqual(["PARTY 1", "PARTY 2"]);
    expect(template.coverPage.signatureRows).toEqual([
      { label: "Signature", hint: undefined },
      { label: "Print Name", hint: undefined },
      { label: "Title", hint: undefined },
      { label: "Company", hint: undefined },
      { label: "Notice Address", hint: "Use either email or postal address" },
      { label: "Date", hint: undefined },
    ]);
  });

  it("reads all eleven standard terms and both attributions", () => {
    expect(template.standardTerms.clauses.map((clause) => clause.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(template.coverPage.attribution).toContain("CC BY 4.0");
    expect(template.standardTerms.attribution).toContain("CC BY 4.0");
  });

  it("rejects a file that is not the cover page", () => {
    expect(() => parseNdaTemplate({ coverPage: "hello", standardTerms: "" })).toThrow(
      /Mutual NDA template/,
    );
  });
});

describe("buildNdaDocument", () => {
  const blocks = buildNdaDocument(template, completeValues);

  it("fills in the cover page terms", () => {
    expect(sectionText(blocks, "Purpose")).toEqual([completeValues.purpose]);
    expect(sectionText(blocks, "Effective Date")).toEqual(["November 14, 2026"]);
    expect(sectionText(blocks, "MNDA Term")).toEqual([
      "[x] Expires 1 year from Effective Date.",
      "[ ] Continues until terminated in accordance with the terms of the MNDA.",
    ]);
    expect(sectionText(blocks, "Governing Law & Jurisdiction")).toEqual([
      "Governing Law: Delaware",
      "Jurisdiction: New Castle, DE",
    ]);
    expect(sectionText(blocks, "MNDA Modifications")[0]).toBe("None.");
  });

  it("ticks the other option when a term is open-ended", () => {
    const openEnded = buildNdaDocument(template, {
      ...completeValues,
      mndaTermType: "untilTerminated",
      confidentialityTermType: "perpetual",
      confidentialityTermYears: "3",
    });
    expect(sectionText(openEnded, "MNDA Term").map((line) => line.slice(0, 3))).toEqual([
      "[ ]",
      "[x]",
    ]);
    expect(sectionText(openEnded, "Term of Confidentiality")).toEqual([
      "[ ] 3 years from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
      "[x] In perpetuity.",
    ]);
  });

  it("lists modifications one paragraph per line", () => {
    const modified = buildNdaDocument(template, {
      ...completeValues,
      modifications: "Section 5 is deleted.\n\nSection 9 is amended.",
    });
    expect(sectionText(modified, "MNDA Modifications").slice(0, 2)).toEqual([
      "Section 5 is deleted.",
      "Section 9 is amended.",
    ]);
  });

  it("puts each party in the signature table and leaves signature and date blank", () => {
    const table = blocks.find((block) => block.type === "signatures");
    expect(table?.rows.map((row) => [row.label, ...row.values])).toEqual([
      ["Signature", "", ""],
      ["Print Name", "Ada Lovelace", "Alan Turing"],
      ["Title", "CEO", "CTO"],
      ["Company", "Acme, Inc.", "Globex LLC"],
      ["Notice Address", "ada@acme.test", "1 Main St"],
      ["Date", "", ""],
    ]);
  });

  it("leaves no unfilled placeholder when the form is complete", () => {
    const missing = blocks.flatMap((block) =>
      block.type === "paragraph" || block.type === "clause"
        ? block.content.filter((run) => run.fill === "missing")
        : block.type === "options"
          ? block.options.flatMap((o) => o.content.filter((run) => run.fill === "missing"))
          : [],
    );
    expect(missing).toEqual([]);
  });

  it("marks empty required values as missing placeholders", () => {
    const incomplete = buildNdaDocument(template, { ...completeValues, governingLaw: " " });
    const law = incomplete.find(
      (block) => block.type === "paragraph" && text(block.content).startsWith("Governing Law"),
    );
    expect(law).toMatchObject({
      content: [{ text: "Governing Law: " }, { text: "[Fill in state]", fill: "missing" }],
    });
  });

  it("reproduces the standard terms word for word", () => {
    const clauses = blocks.filter((block) => block.type === "clause");
    expect(clauses).toHaveLength(11);
    expect(text(clauses[8].content)).toContain(
      "the laws of the State of Governing Law, without regard to",
    );
    expect(clauses.flatMap((clause) => clause.content).some((run) => run.fill)).toBe(false);
    expect(text(clauses[0].content)).not.toMatch(/[<>*]/);
  });
});

describe("validation and formatting", () => {
  it("requires the terms but not the party details", () => {
    expect(getMissingFields(completeValues)).toEqual([]);
    expect(getMissingFields(defaultFormValues())).toEqual(["Governing law", "Jurisdiction"]);
    expect(
      getMissingFields({
        ...completeValues,
        purpose: "",
        effectiveDate: "",
        mndaTermYears: "0",
        confidentialityTermYears: "1.5",
      }),
    ).toEqual(["Purpose", "Effective date", "MNDA term", "Term of confidentiality"]);
  });

  it("ignores the number of years when the term is open-ended", () => {
    expect(
      getMissingFields({ ...completeValues, mndaTermType: "untilTerminated", mndaTermYears: "" }),
    ).toEqual([]);
  });

  it("formats dates and years", () => {
    expect(formatDate("2026-01-05")).toBe("January 5, 2026");
    expect(formatDate("2026-02-30")).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatYears("1")).toBe("1 year");
    expect(formatYears(" 5 ")).toBe("5 years");
    expect(formatYears("-1")).toBe("");
  });

  it("flags characters the PDF font cannot draw", () => {
    const [first, second] = completeValues.parties;
    expect(
      findUnsupportedCharacters({
        ...completeValues,
        purpose: "Évaluer “un partenariat” – €5m",
        parties: [{ ...first, company: "Łódź Ελλάδα Москва" }, second],
      }),
    ).toEqual([]);
    expect(
      findUnsupportedCharacters({
        ...completeValues,
        jurisdiction: "東京 Tokyo 東",
        parties: [first, { ...second, name: "Ada 🙂" }],
      }),
    ).toEqual(["東", "京", "🙂"]);
  });

  it("names the PDF after the parties", () => {
    expect(pdfFileName(completeValues)).toBe("Mutual-NDA-Acme-Inc-Globex-LLC.pdf");
    expect(pdfFileName(defaultFormValues())).toBe("Mutual-NDA.pdf");
  });
});
