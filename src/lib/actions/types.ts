/**
 * Types partagés des Server Actions (module 5 → 8).
 *
 * Ce module est volontairement libre de la directive `use server` :
 * il peut donc être importé par des Client Components (types + helpers).
 */

/** Clé = chemin pointé du champ ("contactName", "methods.0.name"). */
export type FieldErrors = Record<string, string>;

export type ActionFailure = {
  success: false;
  error: string;
  fieldErrors?: FieldErrors;
};

export type ActionResult = { success: true; message?: string } | ActionFailure;

export function failure(error: string, fieldErrors?: FieldErrors): ActionFailure {
  return { success: false, error, fieldErrors };
}
