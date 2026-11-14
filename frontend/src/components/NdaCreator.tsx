"use client";

import { useMemo, useState } from "react";

import {
  buildNdaDocument,
  defaultFormValues,
  findUnsupportedCharacters,
  getMissingFields,
  pdfFileName,
} from "@/lib/nda/document";
import type { NdaFormValues, NdaTemplate } from "@/lib/nda/types";

import { NdaForm } from "./NdaForm";
import { NdaPreview } from "./NdaPreview";

type DownloadState = "idle" | "generating" | "failed";

/** The form, the live preview and the download button. Everything stays in the browser. */
export default function NdaCreator({ template }: { template: NdaTemplate }) {
  const [values, setValues] = useState<NdaFormValues>(() => defaultFormValues());
  const [download, setDownload] = useState<DownloadState>("idle");

  const blocks = useMemo(() => buildNdaDocument(template, values), [template, values]);
  const missing = getMissingFields(values);
  const unsupported = findUnsupportedCharacters(values);

  const handleDownload = async () => {
    setDownload("generating");
    try {
      // Loaded on demand so the PDF library is not part of the initial page load.
      const { downloadNdaPdf } = await import("./NdaPdf");
      await downloadNdaPdf(blocks, pdfFileName(values));
      setDownload("idle");
    } catch (error) {
      console.error("Could not generate the PDF", error);
      setDownload("failed");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Mutual NDA creator</h1>
          <p className="text-sm text-zinc-500">
            Fill in the details and download a ready-to-sign agreement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p role="status" className="max-w-xs text-right text-xs text-zinc-500">
            {download === "failed" ? (
              <span className="text-red-700">The PDF could not be generated. Please try again.</span>
            ) : unsupported.length > 0 ? (
              <span className="text-red-700">
                The PDF cannot show these characters, please replace them:{" "}
                {unsupported.join(" ")}
              </span>
            ) : missing.length > 0 ? (
              `To download, complete: ${missing.join(", ")}.`
            ) : null}
          </p>
          <button
            type="button"
            onClick={handleDownload}
            disabled={missing.length > 0 || unsupported.length > 0 || download === "generating"}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow-xs hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {download === "generating" ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </header>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(22rem,26rem)_1fr] lg:grid-rows-[minmax(0,1fr)]">
        <section
          aria-label="Agreement details"
          className="border-zinc-200 bg-white p-4 sm:p-6 lg:overflow-y-auto lg:border-r"
        >
          <NdaForm
            values={values}
            onChange={(change) => setValues((current) => ({ ...current, ...change }))}
          />
        </section>
        <section aria-label="Preview" className="bg-zinc-100 p-4 sm:p-8 lg:overflow-y-auto">
          <NdaPreview blocks={blocks} />
        </section>
      </div>
    </div>
  );
}
