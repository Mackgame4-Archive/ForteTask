"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

type ChecklistItem = {
  id: number | null
  title: string
  completed: boolean
}

type ChecklistProps = {
  items?: ChecklistItem[]
}

function Checklist({ items: initialItems = [] }: ChecklistProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([
    ...(initialItems.length
      ? initialItems
      : [{ id: null, title: "Checklist", completed: false }]),
  ])

  function addItem() {
    setChecklistItems((currentItems) => [
      ...currentItems,
      { id: null, title: "Checklist", completed: false },
    ])
  }

  function removeItem(index: number) {
    setChecklistItems((currentItems) =>
      currentItems.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  return (
    <div className="space-y-2">
      {checklistItems.map((item, index) => (
        <InputGroup key={`${item.id ?? "new"}-${index}`}>
          <input type="hidden" name="subTaskId" value={item.id ?? ""} />
          <InputGroupAddon>
            <Checkbox
              name="completedSubTaskId"
              value={item.id ? String(item.id) : `new-${index}`}
              defaultChecked={item.completed}
              aria-label="Concluir item da checklist"
              className="cursor-pointer"
            />
          </InputGroupAddon>
          <InputGroupInput name="subTaskTitle" defaultValue={item.title} />
          <InputGroupAddon align="inline-end">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remover item da checklist"
              onClick={() => removeItem(index)}
            >
              <Trash2 />
            </Button>
          </InputGroupAddon>
        </InputGroup>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        <Plus />
        Adicionar item
      </Button>
    </div>
  )
}

export { Checklist }
