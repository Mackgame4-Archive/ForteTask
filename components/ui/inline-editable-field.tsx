// https://www.shadcn-form.com/components/

'use client'

import * as React from 'react'
import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type InlineEditableFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  name?: string
  placeholder?: string
  required?: boolean
  maxLength?: number
  className?: string
}

export function InlineEditableField({
  id,
  value,
  onChange,
  name,
  placeholder = 'Click to edit',
  required,
  maxLength,
  className,
}: InlineEditableFieldProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')

  const save = () => {
    onChange(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <>
        {name ? (
          <input type="hidden" name={name} value={value} />
        ) : null}
        <Input
          id={id}
          autoFocus
          value={draft}
          required={required}
          maxLength={maxLength}
          className={cn('w-full', className)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
            if (event.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
        />
      </>
    )
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Button
        id={id}
        type="button"
        variant="ghost"
        className={cn('h-auto w-full justify-start px-2', className)}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        <span className="truncate text-left">{value || placeholder}</span>
        <Pencil className="ml-2 h-4 w-4" />
      </Button>
    </>
  )
}
