import type {
  CoverPageSection,
  CoverPageTemplate,
  Inline,
  NdaTemplate,
  SignatureRow,
  StandardTermsTemplate,
} from "./types";

/**
 * Parsers for the two Common Paper Mutual NDA Markdown files in `/templates`.
 * They only understand the small Markdown subset those files use, and throw if
 * the structure is not what the app expects, so a template change fails the
 * build instead of silently producing a broken agreement.
 */

const LABEL = /<label>(.*?)<\/label>/;
const INLINE_TOKEN =
  /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|<span class="coverpage_link">(.*?)<\/span>/g;

/** Converts inline Markdown (bold, links, cover page term spans) to styled text runs. */
export function parseInline(markdown: string): Inline[] {
  const runs: Inline[] = [];
  let last = 0;
  for (const match of markdown.matchAll(INLINE_TOKEN)) {
    if (match.index > last) runs.push({ text: markdown.slice(last, match.index) });
    const [, bold, linkText, href, term] = match;
    if (bold !== undefined) runs.push({ text: bold, bold: true });
    else if (linkText !== undefined) runs.push({ text: linkText, href });
    else runs.push({ text: term });
    last = match.index + match[0].length;
  }
  if (last < markdown.length) runs.push({ text: markdown.slice(last) });
  return runs;
}

function splitLabel(text: string): { text: string; hint?: string } {
  const hint = text.match(LABEL)?.[1].trim();
  return { text: text.replace(LABEL, "").trim(), hint };
}

function contentLines(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined || value === "") {
    throw new Error(`Mutual NDA template: could not find ${what}.`);
  }
  return value;
}

export function parseCoverPage(markdown: string): CoverPageTemplate {
  let title: string | undefined;
  let introHeading: string | undefined;
  const introLines: string[] = [];
  const sections: CoverPageSection[] = [];
  const tableLines: string[] = [];
  const afterTable: string[] = [];

  for (const line of contentLines(markdown)) {
    const section = sections.at(-1);
    if (line.startsWith("### ")) sections.push({ heading: line.slice(4).trim(), lines: [] });
    else if (line.startsWith("## ")) introHeading = line.slice(3).trim();
    else if (line.startsWith("# ")) title = line.slice(2).trim();
    else if (line.startsWith("|")) tableLines.push(line);
    else if (tableLines.length > 0) afterTable.push(line);
    else if (!section) introLines.push(line);
    else if (/^<label>.*<\/label>$/.test(line)) section.hint = splitLabel(line).hint;
    else section.lines.push(line);
  }

  // The last section ends with the sentence the parties sign under.
  const signingStatement = sections.at(-1)?.lines.pop();

  const [headerRow, , ...bodyRows] = tableLines.map((row) =>
    row.split("|").map((cell) => cell.trim()),
  );
  const signatureRows: SignatureRow[] = bodyRows.map((cells) => {
    const { text, hint } = splitLabel(cells[1]);
    return { label: text, hint };
  });

  return {
    title: required(title, "the cover page title"),
    introHeading: required(introHeading, "the cover page introduction heading"),
    intro: required(introLines.join(" "), "the cover page introduction"),
    sections,
    signingStatement: required(signingStatement, "the signing statement"),
    partyLabels: required(headerRow, "the signature table").filter(Boolean),
    signatureRows,
    attribution: required(afterTable.join(" "), "the cover page attribution"),
  };
}

export function parseStandardTerms(markdown: string): StandardTermsTemplate {
  let title: string | undefined;
  const clauses: StandardTermsTemplate["clauses"] = [];
  const trailing: string[] = [];

  for (const line of contentLines(markdown)) {
    const clause = line.match(/^(\d+)\.\s+(.*)$/);
    if (clause) clauses.push({ number: Number(clause[1]), text: clause[2] });
    else if (line.startsWith("# ")) title = line.slice(2).trim();
    else trailing.push(line);
  }

  if (clauses.length === 0) throw new Error("Mutual NDA template: no standard terms found.");
  return {
    title: required(title, "the standard terms title"),
    clauses,
    attribution: required(trailing.join(" "), "the standard terms attribution"),
  };
}

export function parseNdaTemplate(source: { coverPage: string; standardTerms: string }): NdaTemplate {
  return {
    coverPage: parseCoverPage(source.coverPage),
    standardTerms: parseStandardTerms(source.standardTerms),
  };
}
