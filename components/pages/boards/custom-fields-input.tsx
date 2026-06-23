"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BoardCustomFieldType } from "@/generated/prisma/enums";

type CustomFieldType = BoardCustomFieldType;

const customFieldTypeOptions = Object.values(BoardCustomFieldType).map((type) => ({
  value: type,
  label: type,
}));

type CustomFieldInputValue = {
  id?: number;
  key: string;
  name: string;
  type: CustomFieldType;
  minValue: string;
  maxValue: string;
};

type CustomFieldsInputDefaultValue = {
  id: number;
  name: string;
  type: CustomFieldType;
  minValue: number | null;
  maxValue: number | null;
};

type CustomFieldsInputProps = {
  defaultValue?: CustomFieldsInputDefaultValue[];
};

function createField(
  field?: CustomFieldsInputDefaultValue
): CustomFieldInputValue {
  return {
    id: field?.id,
    key: field?.id ? `field-${field.id}` : crypto.randomUUID(),
    name: field?.name ?? "",
    type: field?.type ?? BoardCustomFieldType.STRING,
    minValue: field?.minValue == null ? "" : String(field.minValue),
    maxValue: field?.maxValue == null ? "" : String(field.maxValue),
  };
}

function CustomFieldsInput({ defaultValue = [] }: CustomFieldsInputProps) {
  const [fields, setFields] = useState(() => defaultValue.map(createField));

  function updateField(
    key: string,
    nextValue: Partial<Omit<CustomFieldInputValue, "key" | "id">>
  ) {
    setFields((currentFields) =>
      currentFields.map((field) =>
        field.key === key ? { ...field, ...nextValue } : field
      )
    );
  }

  function addField() {
    setFields((currentFields) => [...currentFields, createField()]);
  }

  function removeField(key: string) {
    setFields((currentFields) =>
      currentFields.filter((field) => field.key !== key)
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Campos personalizados</Label>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus />
          Adicionar campo
        </Button>
      </div>

      {fields.length ? (
        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.key} className="grid gap-2 border border-border p-3">
              <input type="hidden" name="customFieldId" value={field.id ?? ""} />
              <input type="hidden" name="customFieldType" value={field.type} />

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_2rem]">
                <Input
                  name="customFieldName"
                  value={field.name}
                  maxLength={80}
                  placeholder="Nome do campo"
                  onChange={(event) =>
                    updateField(field.key, { name: event.currentTarget.value })
                  }
                />
                <Select
                  value={field.type}
                  onValueChange={(value) => {
                    if (
                      value !== BoardCustomFieldType.STRING &&
                      value !== BoardCustomFieldType.INTEGER
                    ) {
                      return;
                    }

                    updateField(field.key, {
                      type: value,
                      minValue:
                        value === BoardCustomFieldType.INTEGER && !field.minValue
                          ? "0"
                          : field.minValue,
                      maxValue:
                        value === BoardCustomFieldType.INTEGER && !field.maxValue
                          ? "10"
                          : field.maxValue,
                    });
                  }}
                  items={customFieldTypeOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customFieldTypeOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        label={option.label}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover campo personalizado"
                  onClick={() => removeField(field.key)}
                >
                  <Trash2 />
                </Button>
              </div>

              {field.type === BoardCustomFieldType.INTEGER ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    name="customFieldMinValue"
                    type="number"
                    value={field.minValue}
                    placeholder="Minimo"
                    onChange={(event) =>
                      updateField(field.key, {
                        minValue: event.currentTarget.value,
                      })
                    }
                  />
                  <Input
                    name="customFieldMaxValue"
                    type="number"
                    value={field.maxValue}
                    placeholder="Maximo"
                    onChange={(event) =>
                      updateField(field.key, {
                        maxValue: event.currentTarget.value,
                      })
                    }
                  />
                </div>
              ) : (
                <>
                  <input type="hidden" name="customFieldMinValue" value="" />
                  <input type="hidden" name="customFieldMaxValue" value="" />
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          Ainda nao existem campos personalizados.
        </p>
      )}
    </div>
  );
}

export { CustomFieldsInput };
