"use client"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"

type MultiselectOption = {
  label: string
  value: string
}

type MultiselectProps = {
  name?: string
  placeholder?: string
  emptyText?: string
  required?: boolean
  defaultValue?: string[]
  value?: string[]
  onValueChange?: (value: string[]) => void
  options: MultiselectOption[]
}

function Multiselect({
  name,
  placeholder = "Selecionar opções",
  emptyText = "Nenhum item encontrado.",
  required = false,
  defaultValue = [],
  value,
  onValueChange,
  options,
}: MultiselectProps) {
  const anchor = useComboboxAnchor()
  const selectedValue = value ?? defaultValue
  const selectedOptions = options.filter((option) =>
    selectedValue.includes(option.value)
  )

  return (
    <Combobox
      name={name}
      multiple
      autoHighlight
      required={required}
      items={options}
      defaultValue={value ? undefined : selectedOptions}
      value={value ? selectedOptions : undefined}
      onValueChange={(nextValue) => {
        const nextOptions = Array.isArray(nextValue)
          ? nextValue
          : nextValue
            ? [nextValue]
            : []
        onValueChange?.(nextOptions.map((option) => option.value))
      }}
      itemToStringLabel={(option: MultiselectOption) => option.label}
      itemToStringValue={(option: MultiselectOption) => option.value}
      isItemEqualToValue={(option: MultiselectOption, value: MultiselectOption) =>
        option.value === value.value
      }
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values) => (
            <>
              {values.map((option: MultiselectOption) => (
                <ComboboxChip key={option.value}>
                  {option.label}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput placeholder={placeholder} />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(option: MultiselectOption) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export { Multiselect }
export type { MultiselectOption }
