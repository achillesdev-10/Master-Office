import {
  CURRENCIES,
  CURRENCY_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  TIMEZONES,
} from "@/lib/validators/tenant";
import { Field } from "../field";
import { Select } from "@/components/ui/input";
import type { StepProps } from "../types";

const CURRENCY_OPTIONS = CURRENCIES.map((value) => ({
  value,
  label: CURRENCY_LABELS[value],
}));

const LANGUAGE_OPTIONS = LANGUAGES.map((value) => ({
  value,
  label: LANGUAGE_LABELS[value],
}));

/** Étape 3 — Configuration : devise, langue, fuseau horaire. */
export function StepConfiguration({ values, onChange, errors }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Devise" htmlFor="currency" error={errors.currency}>
        <Select
          id="currency"
          value={values.currency}
          onChange={(event) =>
            onChange({ currency: event.target.value as typeof values.currency })
          }
        >
          {CURRENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Langue" htmlFor="language" error={errors.language}>
        <Select
          id="language"
          value={values.language}
          onChange={(event) =>
            onChange({
              language: event.target.value as typeof values.language,
            })
          }
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Fuseau horaire" htmlFor="timezone" error={errors.timezone}>
        <Select
          id="timezone"
          value={values.timezone}
          onChange={(event) => onChange({ timezone: event.target.value })}
        >
          {TIMEZONES.map((timezone) => (
            <option key={timezone} value={timezone}>
              {timezone}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
