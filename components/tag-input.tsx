"use client"

import { useState } from "react"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxValue,
} from "@/components/ui/combobox"

type TagInputProps = {
  name: string
  defaultValue?: string[]
  placeholder?: string
}

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function TagInput({
  name,
  defaultValue = [],
  placeholder = "Adicionar etiquetas",
}: TagInputProps) {
  const [tags, setTags] = useState(
    defaultValue.map(normalizeTag).filter(Boolean)
  )
  const [inputValue, setInputValue] = useState("")

  function addTag(value: string) {
    const tag = normalizeTag(value)

    if (!tag || tags.includes(tag)) {
      setInputValue("")
      return
    }

    setTags((currentTags) => [...currentTags, tag])
    setInputValue("")
  }

  return (
    <Combobox
      multiple
      items={tags}
      value={tags}
      onValueChange={(value) => setTags(Array.isArray(value) ? value : [])}
    >
      <ComboboxChips className="w-full">
        <ComboboxValue>
          {(values) => (
            <>
              {values.map((tag: string) => (
                <span key={tag} className="contents">
                  <input type="hidden" name={name} value={tag} />
                  <ComboboxChip>{tag}</ComboboxChip>
                </span>
              ))}
              <ComboboxChipsInput
                value={inputValue}
                placeholder={placeholder}
                onChange={(event) => setInputValue(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault()
                    addTag(event.currentTarget.value)
                  }

                  if (
                    event.key === "Backspace" &&
                    !event.currentTarget.value &&
                    tags.length
                  ) {
                    setTags((currentTags) => currentTags.slice(0, -1))
                  }
                }}
                onBlur={(event) => addTag(event.currentTarget.value)}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
    </Combobox>
  )
}

export { TagInput }
