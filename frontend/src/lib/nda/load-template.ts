import { readFileSync } from "node:fs";
import path from "node:path";

import { parseNdaTemplate } from "./template";
import type { NdaTemplate } from "./types";

/**
 * The Common Paper templates live at the repository root, next to `frontend/`,
 * so the app and any future backend share a single copy.
 */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

const read = (file: string) => readFileSync(path.join(TEMPLATES_DIR, file), "utf8");

/**
 * Reads and parses the Mutual NDA templates. Server-only.
 *
 * The read is synchronous on purpose: Next.js then treats the result as a
 * predictable value and prerenders the page at build time.
 */
export function loadNdaTemplate(): NdaTemplate {
  return parseNdaTemplate({
    coverPage: read("Mutual-NDA-coverpage.md"),
    standardTerms: read("Mutual-NDA.md"),
  });
}
