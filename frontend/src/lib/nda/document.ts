import { parseInline } from "./template";
import type { Block, Inline, NdaFormValues, NdaTemplate, PartyDetails } from "./types";

/** A `[placeholder]` in the cover page. The lookahead skips Markdown links. */
const PLACEHOLDER = /\[([^\]]+)\](?!\()/g;
/** A `- [x] ...` / `- [ ] ...` choice in the cover page. */
const OPTION = /^- \[[ x]\]\s+(.*)$/i;

const emptyParty: PartyDetails = { company: "", name: "", title: "", noticeAddress: "" };

export function defaultFormValues(today: Date = new Date()): NdaFormValues {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    purpose: "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    mndaTermType: "fixed",
    mndaTermYears: "1",
    confidentialityTermType: "fixed",
    confidentialityTermYears: "1",
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    parties: [{ ...emptyParty }, { ...emptyParty }],
  };
}

/** `2026-11-14` -> `November 14, 2026`. Returns "" for anything that is not a real date. */
export function formatDate(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** `"2"` -> `2 years`. Returns "" unless the input is a whole number of at least 1. */
export function formatYears(years: string): string {
  const trimmed = years.trim();
  if (!/^\d+$/.test(trimmed)) return "";
  const count = Number(trimmed);
  if (count < 1) return "";
  return `${count} ${count === 1 ? "year" : "years"}`;
}

/** Names of the required fields that are still empty or invalid. */
export function getMissingFields(values: NdaFormValues): string[] {
  const checks: [string, boolean][] = [
    ["Purpose", values.purpose.trim() !== ""],
    ["Effective date", formatDate(values.effectiveDate) !== ""],
    ["MNDA term", values.mndaTermType !== "fixed" || formatYears(values.mndaTermYears) !== ""],
    [
      "Term of confidentiality",
      values.confidentialityTermType !== "fixed" ||
        formatYears(values.confidentialityTermYears) !== "",
    ],
    ["Governing law", values.governingLaw.trim() !== ""],
    ["Jurisdiction", values.jurisdiction.trim() !== ""],
  ];
  return checks.filter(([, ok]) => !ok).map(([name]) => name);
}

/**
 * What the font embedded in the PDF (Noto Serif) can draw: Latin, Greek and
 * Cyrillic letters, digits, punctuation and currency symbols.
 */
const PDF_SUPPORTED =
  /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\s\u0020-\u007E\u00A0-\u00FF\u0300-\u036F\u2010-\u2027\u2030-\u205E\u20A0-\u20C0\u2116\u2122\u2212]/u;

/** Characters the user typed that would come out wrong in the PDF, without repeats. */
export function findUnsupportedCharacters(values: NdaFormValues): string[] {
  const { parties, ...terms } = values;
  const typed = [...Object.values(terms), ...parties.flatMap((party) => Object.values(party))];
  const unsupported = Array.from(typed.join("")).filter((char) => !PDF_SUPPORTED.test(char));
  return [...new Set(unsupported)];
}

export function pdfFileName(values: NdaFormValues): string {
  const companies = values.parties
    .map((party) => party.company.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""))
    .filter(Boolean);
  return ["Mutual-NDA", ...companies].join("-") + ".pdf";
}

/** How the form values map onto each cover page section, keyed by its heading. */
interface SectionFill {
  /** Values for the section's `[placeholders]`, in the order they appear. */
  fills?: string[];
  /** Index of the ticked `- [ ]` option. */
  selected?: number;
  /** Replaces the template's body entirely (used for free text). */
  body?: string[];
}

function sectionFills(values: NdaFormValues): Record<string, SectionFill> {
  const modifications = values.modifications
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    Purpose: { fills: [values.purpose.trim()] },
    "Effective Date": { fills: [formatDate(values.effectiveDate)] },
    "MNDA Term": {
      fills: [formatYears(values.mndaTermYears)],
      selected: values.mndaTermType === "fixed" ? 0 : 1,
    },
    "Term of Confidentiality": {
      fills: [formatYears(values.confidentialityTermYears)],
      selected: values.confidentialityTermType === "fixed" ? 0 : 1,
    },
    "Governing Law & Jurisdiction": {
      fills: [values.governingLaw.trim(), values.jurisdiction.trim()],
    },
    "MNDA Modifications": { body: modifications.length > 0 ? modifications : ["None."] },
  };
}

export const COVER_PAGE_SECTIONS = Object.keys(sectionFills(defaultFormValues()));

/** Replaces each `[placeholder]` in a template line with the next value from `fills`. */
function fillLine(line: string, fills: string[]): Inline[] {
  const runs: Inline[] = [];
  let last = 0;
  for (const match of line.matchAll(PLACEHOLDER)) {
    runs.push(...parseInline(line.slice(last, match.index)));
    const value = fills.shift();
    runs.push(value ? { text: value, fill: "value" } : { text: match[0], fill: "missing" });
    last = match.index + match[0].length;
  }
  runs.push(...parseInline(line.slice(last)));
  return runs;
}

const SIGNATURE_VALUES: Record<string, (party: PartyDetails) => string> = {
  "Print Name": (party) => party.name,
  Title: (party) => party.title,
  Company: (party) => party.company,
  "Notice Address": (party) => party.noticeAddress,
};

/**
 * Builds the completed Mutual NDA.
 *
 * Only the Cover Page is filled in. The Standard Terms are reproduced verbatim:
 * they refer to the Cover Page through defined terms ("Purpose", "Effective
 * Date", ...), and the Cover Page states they are identical to the published
 * Common Paper terms, so they must not be edited.
 */
export function buildNdaDocument(template: NdaTemplate, values: NdaFormValues): Block[] {
  const { coverPage, standardTerms } = template;
  const fillsByHeading = sectionFills(values);

  const blocks: Block[] = [
    { type: "heading", level: 1, text: coverPage.title },
    { type: "heading", level: 2, text: coverPage.introHeading },
    { type: "paragraph", content: parseInline(coverPage.intro) },
  ];

  for (const section of coverPage.sections) {
    const { fills = [], selected, body } = fillsByHeading[section.heading] ?? {};
    blocks.push({ type: "heading", level: 3, text: section.heading, hint: section.hint });

    if (body) {
      for (const text of body) {
        blocks.push({ type: "paragraph", content: [{ text, fill: "value" }] });
      }
      continue;
    }

    const remaining = [...fills];
    const options: { checked: boolean; content: Inline[] }[] = [];
    for (const line of section.lines) {
      const option = line.match(OPTION);
      if (option) {
        options.push({
          checked: options.length === selected,
          content: fillLine(option[1], remaining),
        });
      } else {
        blocks.push({ type: "paragraph", content: fillLine(line, remaining) });
      }
    }
    if (options.length > 0) blocks.push({ type: "options", options });
  }

  blocks.push(
    {
      type: "signatures",
      statement: parseInline(coverPage.signingStatement),
      partyLabels: coverPage.partyLabels,
      rows: coverPage.signatureRows.map((row) => ({
        ...row,
        values: values.parties.map((party) => SIGNATURE_VALUES[row.label]?.(party).trim() ?? ""),
      })),
    },
    { type: "paragraph", content: parseInline(coverPage.attribution), small: true },
    { type: "heading", level: 1, text: standardTerms.title, pageBreak: true },
    ...standardTerms.clauses.map(
      (clause): Block => ({
        type: "clause",
        number: clause.number,
        content: parseInline(clause.text),
      }),
    ),
    { type: "paragraph", content: parseInline(standardTerms.attribution), small: true },
  );

  return blocks;
}
