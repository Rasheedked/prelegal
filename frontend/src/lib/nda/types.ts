/** What the user enters in the form. Everything is a string so it maps 1:1 to inputs. */
export interface PartyDetails {
  company: string;
  name: string;
  title: string;
  noticeAddress: string;
}

export type MndaTermType = "fixed" | "untilTerminated";
export type ConfidentialityTermType = "fixed" | "perpetual";

export interface NdaFormValues {
  purpose: string;
  /** ISO date, `YYYY-MM-DD` (the value of an `<input type="date">`). */
  effectiveDate: string;
  mndaTermType: MndaTermType;
  mndaTermYears: string;
  confidentialityTermType: ConfidentialityTermType;
  confidentialityTermYears: string;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  parties: [PartyDetails, PartyDetails];
}

/** The Common Paper Mutual NDA templates, parsed into the pieces the app fills in. */
export interface CoverPageSection {
  heading: string;
  /** Short explanatory note shown under the heading (`<label>` in the template). */
  hint?: string;
  /** Raw Markdown body lines, including `[placeholders]` and `- [x]` options. */
  lines: string[];
}

export interface SignatureRow {
  label: string;
  hint?: string;
}

export interface CoverPageTemplate {
  title: string;
  introHeading: string;
  intro: string;
  sections: CoverPageSection[];
  signingStatement: string;
  partyLabels: string[];
  signatureRows: SignatureRow[];
  attribution: string;
}

export interface StandardTermsTemplate {
  title: string;
  clauses: { number: number; text: string }[];
  attribution: string;
}

export interface NdaTemplate {
  coverPage: CoverPageTemplate;
  standardTerms: StandardTermsTemplate;
}

/**
 * The completed agreement as a flat list of blocks. Both the on-screen preview
 * and the PDF are rendered from this, so they cannot drift apart.
 */
export interface Inline {
  text: string;
  bold?: boolean;
  href?: string;
  /** Set on text that came from the form: a filled-in value, or a still-empty placeholder. */
  fill?: "value" | "missing";
}

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string; hint?: string; pageBreak?: boolean }
  | { type: "paragraph"; content: Inline[]; small?: boolean }
  | { type: "options"; options: { checked: boolean; content: Inline[] }[] }
  | { type: "clause"; number: number; content: Inline[] }
  | {
      type: "signatures";
      /** The sentence the parties sign under. */
      statement: Inline[];
      partyLabels: string[];
      rows: { label: string; hint?: string; values: string[] }[];
    };
