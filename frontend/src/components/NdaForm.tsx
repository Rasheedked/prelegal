import { useId, type ReactNode } from "react";

import type { NdaFormValues, PartyDetails } from "@/lib/nda/types";

const controlClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none";
const inputClass = `${controlClass} w-full`;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      <div className="mt-1">{children(id)}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-zinc-200 pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-4 w-full text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {title}
      </legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}

/** A two-way choice where the first option carries a "number of years" input. */
function TermChoice({
  legend,
  hint,
  fixed,
  years,
  fixedSuffix,
  otherLabel,
  onChange,
}: {
  legend: string;
  hint: string;
  fixed: boolean;
  years: string;
  fixedSuffix: string;
  otherLabel: string;
  onChange: (change: { fixed?: boolean; years?: string }) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-800">{legend}</legend>
      <p className="text-xs text-zinc-500">{hint}</p>
      <div className="mt-2 space-y-2 text-sm text-zinc-800">
        <label className="flex flex-wrap items-center gap-2">
          <input
            type="radio"
            name={name}
            checked={fixed}
            onChange={() => onChange({ fixed: true })}
            className="accent-blue-700"
          />
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            aria-label={`${legend}: number of years`}
            value={years}
            disabled={!fixed}
            onChange={(event) => onChange({ years: event.target.value })}
            className={`${controlClass} w-20 disabled:bg-zinc-100 disabled:text-zinc-400`}
          />
          <span>{fixedSuffix}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            checked={!fixed}
            onChange={() => onChange({ fixed: false })}
            className="accent-blue-700"
          />
          <span>{otherLabel}</span>
        </label>
      </div>
    </fieldset>
  );
}

function PartyFields({
  party,
  onChange,
}: {
  party: PartyDetails;
  onChange: (change: Partial<PartyDetails>) => void;
}) {
  const text = (key: keyof PartyDetails, label: string, autoComplete?: string) => (
    <Field label={label}>
      {(id) => (
        <input
          id={id}
          type="text"
          autoComplete={autoComplete ?? "off"}
          value={party[key]}
          onChange={(event) => onChange({ [key]: event.target.value })}
          className={inputClass}
        />
      )}
    </Field>
  );
  return (
    <>
      {text("company", "Company")}
      <div className="grid grid-cols-2 gap-3">
        {text("name", "Signer's name")}
        {text("title", "Signer's title")}
      </div>
      <Field label="Notice address" hint="Email or postal address">
        {(id) => (
          <textarea
            id={id}
            rows={2}
            value={party.noticeAddress}
            onChange={(event) => onChange({ noticeAddress: event.target.value })}
            className={inputClass}
          />
        )}
      </Field>
    </>
  );
}

export function NdaForm({
  values,
  onChange,
}: {
  values: NdaFormValues;
  onChange: (change: Partial<NdaFormValues>) => void;
}) {
  const changeParty = (index: 0 | 1, change: Partial<PartyDetails>) => {
    const parties: NdaFormValues["parties"] = [...values.parties];
    parties[index] = { ...parties[index], ...change };
    onChange({ parties });
  };

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()} noValidate>
      <Section title="Agreement terms">
        <Field label="Purpose" hint="How Confidential Information may be used">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={values.purpose}
              onChange={(event) => onChange({ purpose: event.target.value })}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Effective date">
          {(id) => (
            <input
              id={id}
              type="date"
              value={values.effectiveDate}
              onChange={(event) => onChange({ effectiveDate: event.target.value })}
              className={inputClass}
            />
          )}
        </Field>
        <TermChoice
          legend="MNDA term"
          hint="The length of this MNDA"
          fixed={values.mndaTermType === "fixed"}
          years={values.mndaTermYears}
          fixedSuffix="year(s) from the Effective Date"
          otherLabel="Continues until terminated"
          onChange={({ fixed, years }) =>
            onChange({
              ...(fixed !== undefined && { mndaTermType: fixed ? "fixed" : "untilTerminated" }),
              ...(years !== undefined && { mndaTermYears: years }),
            })
          }
        />
        <TermChoice
          legend="Term of confidentiality"
          hint="How long Confidential Information is protected"
          fixed={values.confidentialityTermType === "fixed"}
          years={values.confidentialityTermYears}
          fixedSuffix="year(s) from the Effective Date"
          otherLabel="In perpetuity"
          onChange={({ fixed, years }) =>
            onChange({
              ...(fixed !== undefined && {
                confidentialityTermType: fixed ? "fixed" : "perpetual",
              }),
              ...(years !== undefined && { confidentialityTermYears: years }),
            })
          }
        />
        <Field label="Governing law" hint="The state whose laws govern the MNDA">
          {(id) => (
            <input
              id={id}
              type="text"
              placeholder="Delaware"
              value={values.governingLaw}
              onChange={(event) => onChange({ governingLaw: event.target.value })}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Jurisdiction" hint="City or county and state of the courts">
          {(id) => (
            <input
              id={id}
              type="text"
              placeholder="New Castle, DE"
              value={values.jurisdiction}
              onChange={(event) => onChange({ jurisdiction: event.target.value })}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Modifications (optional)" hint="Any changes to the standard terms">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={values.modifications}
              onChange={(event) => onChange({ modifications: event.target.value })}
              className={inputClass}
            />
          )}
        </Field>
      </Section>

      <Section title="Party 1">
        <PartyFields party={values.parties[0]} onChange={(change) => changeParty(0, change)} />
      </Section>
      <Section title="Party 2">
        <PartyFields party={values.parties[1]} onChange={(change) => changeParty(1, change)} />
      </Section>
    </form>
  );
}
