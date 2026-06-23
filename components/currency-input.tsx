"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  appCurrencySymbol,
  applyCurrencyPolarity,
  getCurrencyPrefix,
  type CurrencyPolarity,
} from "@/lib/utils/currency";

type CurrencyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "defaultValue" | "name" | "onChange" | "type" | "value"
> & {
  currency?: string;
  defaultValue?: number | string;
  name: string;
  polarity?: CurrencyPolarity;
};

function toMagnitude(value: number | string | undefined) {
  if (value == null || value === "") {
    return "";
  }

  return String(value).replace(/^-/, "");
}

export function CurrencyInput({
  className,
  currency = appCurrencySymbol,
  defaultValue,
  min = "0",
  name,
  polarity = "positive",
  step = "0.01",
  ...props
}: CurrencyInputProps) {
  const [value, setValue] = React.useState(() => toMagnitude(defaultValue));
  const prefix = getCurrencyPrefix(polarity, currency);
  const submittedValue = applyCurrencyPolarity(value, polarity);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={submittedValue} />
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">
        {prefix}
      </span>
      <Input
        {...props}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value}
        onChange={(event) => setValue(toMagnitude(event.target.value))}
        className={cn("pl-9 tabular-nums", className)}
      />
    </div>
  );
}
