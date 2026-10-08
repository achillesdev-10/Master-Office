import { Plus, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "../field";
import { Input } from "@/components/ui/input";
import type { StepProps } from "../types";

/** Étape 6 — Livraison : méthodes + frais (stockés en centimes). */
export function StepShipping({ values, onChange, errors }: StepProps) {
  const updateMethod = (
    index: number,
    patch: Partial<(typeof values.methods)[number]>,
  ) => {
    onChange({
      methods: values.methods.map((method, position) =>
        position === index ? { ...method, ...patch } : method,
      ),
    });
  };

  const addMethod = () => {
    onChange({
      methods: [
        ...values.methods,
        { name: "", price: 0, enabled: true },
      ],
    });
  };

  const removeMethod = (index: number) => {
    onChange({
      methods: values.methods.filter((_, position) => position !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Les frais sont exprimés dans la devise de la boutique.
        </p>
        <Button variant="outline" size="sm" onClick={addMethod}>
          <Plus className="size-3.5" aria-hidden />
          Ajouter une méthode
        </Button>
      </div>

      <div className="space-y-3">
        {values.methods.map((method, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_9rem_auto_auto]"
          >
            <Field
              label="Méthode"
              htmlFor={`method-name-${index}`}
              error={errors[`methods.${index}.name`]}
            >
              <span className="flex items-center gap-2">
                <Truck
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <Input
                  id={`method-name-${index}`}
                  placeholder="Livraison standard"
                  value={method.name}
                  onChange={(event) =>
                    updateMethod(index, { name: event.target.value })
                  }
                />
              </span>
            </Field>

            <Field
              label="Frais"
              htmlFor={`method-price-${index}`}
              error={errors[`methods.${index}.price`]}
            >
              <Input
                id={`method-price-${index}`}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={(method.price / 100).toString()}
                onChange={(event) => {
                  const amount = Number.parseFloat(event.target.value);
                  updateMethod(index, {
                    price: Number.isFinite(amount)
                      ? Math.max(0, Math.round(amount * 100))
                      : 0,
                  });
                }}
              />
            </Field>

            <Field label="Active" htmlFor={`method-enabled-${index}`}>
              <input
                id={`method-enabled-${index}`}
                type="checkbox"
                className="mt-2 size-4 accent-primary"
                checked={method.enabled}
                onChange={(event) =>
                  updateMethod(index, { enabled: event.target.checked })
                }
              />
            </Field>

            <div className="flex items-end pb-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Supprimer la méthode ${method.name || index + 1}`}
                disabled={values.methods.length <= 1}
                onClick={() => removeMethod(index)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {errors.methods && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {errors.methods}
        </p>
      )}
    </div>
  );
}
