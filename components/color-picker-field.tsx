"use client"

import { useState } from "react"

import { ColorPicker } from "@/components/ui/color-picker"

type ColorPickerFieldProps = {
  name: string
  defaultValue?: string
  swatches?: string[]
  disableTransparency?: boolean
}

function ColorPickerField({
  name,
  defaultValue = "#3b82f6",
  swatches,
  disableTransparency = false,
}: ColorPickerFieldProps) {
  const [color, setColor] = useState(
    disableTransparency ? defaultValue.slice(0, 7) : defaultValue
  )

  return (
    <>
      <input type="hidden" name={name} value={color} />
      <ColorPicker
        value={color}
        onChange={setColor}
        swatches={swatches}
        disableTransparency={disableTransparency}
      />
    </>
  )
}

export { ColorPickerField }
