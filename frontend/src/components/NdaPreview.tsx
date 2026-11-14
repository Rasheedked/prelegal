import type { Block, Inline } from "@/lib/nda/types";

function Runs({ content }: { content: Inline[] }) {
  return content.map((run, index) => {
    if (run.href) {
      return (
        <a
          key={index}
          href={run.href}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 underline"
        >
          {run.text}
        </a>
      );
    }
    if (run.fill === "missing") {
      return (
        <mark key={index} className="rounded bg-amber-100 px-1 text-amber-900">
          {run.text}
        </mark>
      );
    }
    if (run.fill === "value") {
      return (
        <span key={index} className="rounded bg-blue-50 px-0.5 whitespace-pre-wrap">
          {run.text}
        </span>
      );
    }
    return run.bold ? <strong key={index}>{run.text}</strong> : <span key={index}>{run.text}</span>;
  });
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className="mt-1 flex size-4 shrink-0 items-center justify-center border border-zinc-800 text-xs leading-none font-bold"
    >
      {checked ? "✕" : ""}
    </span>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const hint = block.hint && (
        <p className="font-sans text-xs text-zinc-500">{block.hint}</p>
      );
      if (block.level === 1) {
        return (
          <h2
            className={`text-center text-2xl font-bold ${
              block.pageBreak ? "mt-12 border-t border-zinc-300 pt-12" : ""
            }`}
          >
            {block.text}
          </h2>
        );
      }
      if (block.level === 2) {
        return <h3 className="mt-6 text-sm font-bold tracking-wide">{block.text}</h3>;
      }
      return (
        <div className="mt-6">
          <h4 className="text-base font-bold">{block.text}</h4>
          {hint}
        </div>
      );
    }
    case "paragraph":
      return (
        <p className={block.small ? "mt-6 text-xs text-zinc-600" : "mt-2"}>
          <Runs content={block.content} />
        </p>
      );
    case "options":
      return (
        <ul className="mt-2 space-y-1">
          {block.options.map((option, index) => (
            <li key={index} className="flex gap-2">
              <Checkbox checked={option.checked} />
              <span className="sr-only">{option.checked ? "Selected:" : "Not selected:"}</span>
              <span>
                <Runs content={option.content} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "clause":
      return (
        <p className="mt-3 flex gap-2">
          <span className="w-6 shrink-0 text-right">{block.number}.</span>
          <span>
            <Runs content={block.content} />
          </span>
        </p>
      );
    case "signatures":
      return (
        <div className="mt-6 overflow-x-auto">
          <p>
            <Runs content={block.statement} />
          </p>
          <table className="mt-4 w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-1/4 border border-zinc-300 p-2" />
                {block.partyLabels.map((label) => (
                  <th key={label} className="border border-zinc-300 p-2 font-bold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.label}>
                  <th className="border border-zinc-300 p-2 text-left align-top font-normal">
                    {row.label}
                    {row.hint && (
                      <span className="block font-sans text-xs text-zinc-500">{row.hint}</span>
                    )}
                  </th>
                  {row.values.map((value, index) => (
                    <td
                      key={index}
                      className="h-10 border border-zinc-300 p-2 align-top break-words whitespace-pre-wrap"
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** The completed agreement, rendered as a sheet of paper. */
export function NdaPreview({ blocks }: { blocks: Block[] }) {
  return (
    <article
      aria-label="Mutual NDA preview"
      className="mx-auto max-w-[52rem] bg-white px-6 py-10 font-serif text-[15px] leading-relaxed text-zinc-900 shadow-sm ring-1 ring-zinc-200 sm:px-14 sm:py-14"
    >
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </article>
  );
}
