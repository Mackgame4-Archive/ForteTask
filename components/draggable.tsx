"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const DRAG_DATA_TYPE = "application/x-drag-payload"
const DRAG_META_DATA_TYPE = "application/x-drag-meta"

export type DraggablePayload = Record<
  string,
  string | number | boolean | null | undefined
>

type ReorderId = string | number
type ReorderOrientation = "horizontal" | "vertical"

export type DropZoneReorderDetails = {
  beforeId?: string
  targetId?: string
  type: "insert" | "swap"
  orientation: ReorderOrientation
}

type DropZoneReorderOptions = {
  draggedItemId?: ReorderId | null
  group?: string
  itemSelector?: string
  orientation: ReorderOrientation
}

type DragMeta = {
  reorderGroup?: string
  reorderId?: ReorderId
}

type DropZoneReorderConfig<TPayload extends DraggablePayload> =
  | {
      draggedItemId?: ReorderId | null
      getDraggedItemId?: (payload: TPayload) => ReorderId | null | undefined
      group?: string
      itemSelector?: string
      orientation: ReorderOrientation
      when?: (payload: TPayload) => boolean
    }
  | ((payload: TPayload) => DropZoneReorderOptions | null | undefined)

type DraggableItemProps<TPayload extends DraggablePayload> =
  Omit<React.ComponentProps<"div">, "draggable" | "onDragStart" | "onDragEnd"> & {
    payload: TPayload
    disabled?: boolean
    draggingClassName?: string
    effectAllowed?: DataTransfer["effectAllowed"]
    reorderGroup?: string
    reorderId?: ReorderId
    stopPropagation?: boolean
    onDragStart?: (
      payload: TPayload,
      event: React.DragEvent<HTMLDivElement>
    ) => void
    onDragEnd?: (
      payload: TPayload,
      event: React.DragEvent<HTMLDivElement>
    ) => void
  }

type DropZoneProps<TPayload extends DraggablePayload> =
  Omit<
    React.ComponentProps<"div">,
    "onDrop" | "onDragEnter" | "onDragOver" | "onDragLeave"
  > & {
    activeClassName?: string
    disabled?: boolean
    reordable?: boolean
    reorderable?: boolean
    stopPropagation?: boolean
    zoneId?: string | number
    getPayloadZoneId?: (payload: TPayload) => string | number | undefined
    onDragOverPayload?: (event: React.DragEvent<HTMLDivElement>) => void
    onDragEnterZone?: (event: React.DragEvent<HTMLDivElement>) => void
    onDragLeaveZone?: (event: React.DragEvent<HTMLDivElement>) => void
    getReorderOptions?: (
      payload: TPayload
    ) => DropZoneReorderOptions | null | undefined
    reorder?: DropZoneReorderConfig<TPayload>
    reorderGroup?: string
    reorderId?: ReorderId
    reorderOrientation?: ReorderOrientation
    draggedItemId?: ReorderId | null
    onDropPayload: (
      payload: TPayload,
      event: React.DragEvent<HTMLDivElement>,
      reorder?: DropZoneReorderDetails
    ) => void
  }

function readDragPayload<TPayload extends DraggablePayload>(
  event: React.DragEvent
) {
  const rawValue =
    event.dataTransfer.getData(DRAG_DATA_TYPE) ||
    event.dataTransfer.getData("text/plain")

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as TPayload
  } catch {
    return null
  }
}

function readDragMeta(event: React.DragEvent) {
  const rawValue = event.dataTransfer.getData(DRAG_META_DATA_TYPE)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as DragMeta
  } catch {
    return null
  }
}

function getReorderSelector(group?: string) {
  return group
    ? `[data-dnd-reorder-group="${CSS.escape(group)}"]`
    : "[data-dnd-reorder-id]"
}

function resolveReorderOptions<TPayload extends DraggablePayload>({
  draggedItemId,
  getReorderOptions,
  payload,
  reorder,
  reorderGroup,
  reorderOrientation,
  dragMeta,
}: {
  draggedItemId?: ReorderId | null
  dragMeta?: DragMeta | null
  getReorderOptions?: (
    payload: TPayload
  ) => DropZoneReorderOptions | null | undefined
  payload: TPayload
  reorder?: DropZoneReorderConfig<TPayload>
  reorderGroup?: string
  reorderOrientation?: ReorderOrientation
}) {
  if (getReorderOptions) {
    const options = getReorderOptions(payload)

    return options
      ? {
          ...options,
          draggedItemId: options.draggedItemId ?? dragMeta?.reorderId,
        }
      : options
  }

  if (typeof reorder === "function") {
    const options = reorder(payload)

    return options
      ? {
          ...options,
          draggedItemId: options.draggedItemId ?? dragMeta?.reorderId,
          itemSelector:
            options.itemSelector ?? getReorderSelector(options.group ?? reorderGroup),
        }
      : options
  }

  if (reorder) {
    if (reorder.when && !reorder.when(payload)) {
      return null
    }

    const group = reorder.group ?? reorderGroup

    return {
      draggedItemId:
        reorder.draggedItemId ??
        reorder.getDraggedItemId?.(payload) ??
        dragMeta?.reorderId ??
        null,
      group,
      itemSelector: reorder.itemSelector ?? getReorderSelector(group),
      orientation: reorder.orientation,
    }
  }

  if (!reorderOrientation) {
    return null
  }

  return {
    draggedItemId: draggedItemId ?? dragMeta?.reorderId,
    group: reorderGroup,
    itemSelector: getReorderSelector(reorderGroup),
    orientation: reorderOrientation,
  }
}

function getReorderElements(container: HTMLElement, selector: string) {
  const elements = [
    ...(container.matches(selector) ? [container] : []),
    ...Array.from(container.querySelectorAll<HTMLElement>(selector)),
  ]
  const seenIds = new Set<string>()

  return elements.filter((element) => {
    const id = element.dataset.dndReorderId

    if (!id || seenIds.has(id)) {
      return false
    }

    seenIds.add(id)
    return true
  })
}

function getDropZoneReorderDetails({
  container,
  draggedItemId,
  event,
  itemSelector,
  orientation,
}: DropZoneReorderOptions & {
  container: HTMLElement
  event: React.DragEvent<HTMLElement>
  itemSelector: string
}) {
  const draggedId = draggedItemId == null ? null : String(draggedItemId)
  const targetId = container.dataset.dndReorderId

  if (targetId && targetId !== draggedId && container.matches(itemSelector)) {
    return {
      targetId,
      type: "swap" as const,
      orientation,
    }
  }

  const elements = getReorderElements(container, itemSelector).filter(
    (element) => element.dataset.dndReorderId !== draggedId
  )

  for (const element of elements) {
    const rect = element.getBoundingClientRect()
    const pointerPosition =
      orientation === "vertical" ? event.clientY : event.clientX
    const midpoint =
      orientation === "vertical"
        ? rect.top + rect.height / 2
        : rect.left + rect.width / 2

    if (pointerPosition < midpoint) {
      return {
        beforeId: element.dataset.dndReorderId,
        type: "insert" as const,
        orientation,
      }
    }
  }

  return {
    beforeId: undefined,
    type: "insert" as const,
    orientation,
  }
}

function DraggableItem<TPayload extends DraggablePayload>({
  payload,
  disabled = false,
  draggingClassName,
  effectAllowed = "move",
  className,
  reorderGroup,
  reorderId,
  stopPropagation = true,
  onDragStart,
  onDragEnd,
  ...props
}: DraggableItemProps<TPayload>) {
  const [isDragging, setIsDragging] = React.useState(false)

  return (
    <div
      draggable={!disabled}
      className={cn(className, isDragging && draggingClassName)}
      data-dnd-reorder-group={reorderGroup}
      data-dnd-reorder-id={reorderId == null ? undefined : String(reorderId)}
      onDragStart={(event) => {
        if (disabled) {
          event.preventDefault()
          return
        }

        if (stopPropagation) {
          event.stopPropagation()
        }

        const serializedPayload = JSON.stringify(payload)
        const serializedMeta = JSON.stringify({
          reorderGroup,
          reorderId,
        } satisfies DragMeta)

        event.dataTransfer.effectAllowed = effectAllowed
        event.dataTransfer.setData(DRAG_DATA_TYPE, serializedPayload)
        event.dataTransfer.setData(DRAG_META_DATA_TYPE, serializedMeta)
        event.dataTransfer.setData("text/plain", serializedPayload)
        setIsDragging(true)
        onDragStart?.(payload, event)
      }}
      onDragEnd={(event) => {
        if (stopPropagation) {
          event.stopPropagation()
        }

        setIsDragging(false)
        onDragEnd?.(payload, event)
      }}
      {...props}
    />
  )
}

function DropZone<TPayload extends DraggablePayload>({
  activeClassName,
  disabled = false,
  reordable,
  reorderable,
  stopPropagation = true,
  zoneId,
  getPayloadZoneId,
  className,
  draggedItemId,
  getReorderOptions,
  onDragOverPayload,
  onDragEnterZone,
  onDragLeaveZone,
  onDropPayload,
  reorder,
  reorderGroup,
  reorderId,
  reorderOrientation,
  ...props
}: DropZoneProps<TPayload>) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const canReorder = reorderable ?? reordable ?? true

  return (
    <div
      className={cn(className, isDragOver && activeClassName)}
      data-dnd-reorder-group={reorderGroup}
      data-dnd-reorder-id={reorderId == null ? undefined : String(reorderId)}
      onDragEnter={(event) => {
        if (disabled) {
          return
        }

        if (stopPropagation) {
          event.stopPropagation()
        }

        setIsDragOver(true)
        onDragEnterZone?.(event)
      }}
      onDragOver={(event) => {
        if (disabled) {
          return
        }

        event.preventDefault()

        if (stopPropagation) {
          event.stopPropagation()
        }

        event.dataTransfer.dropEffect = "move"
        onDragOverPayload?.(event)
      }}
      onDragLeave={(event) => {
        if (stopPropagation) {
          event.stopPropagation()
        }

        const nextTarget = event.relatedTarget

        if (
          nextTarget instanceof Node &&
          event.currentTarget.contains(nextTarget)
        ) {
          return
        }

        setIsDragOver(false)
        onDragLeaveZone?.(event)
      }}
      onDrop={(event) => {
        if (disabled) {
          return
        }

        event.preventDefault()

        if (stopPropagation) {
          event.stopPropagation()
        }

        setIsDragOver(false)

        const payload = readDragPayload<TPayload>(event)

        if (payload) {
          const payloadZoneId = getPayloadZoneId?.(payload)

          if (
            !canReorder &&
            zoneId !== undefined &&
            payloadZoneId !== undefined &&
            String(zoneId) === String(payloadZoneId)
          ) {
            return
          }

          const reorderOptions = resolveReorderOptions({
            dragMeta: readDragMeta(event),
            draggedItemId,
            getReorderOptions,
            payload,
            reorder,
            reorderGroup,
            reorderOrientation,
          })
          const reorderDetails = reorderOptions
            ? getDropZoneReorderDetails({
                container: event.currentTarget,
                draggedItemId: reorderOptions.draggedItemId,
                event,
                itemSelector:
                  reorderOptions.itemSelector ??
                  getReorderSelector(reorderOptions.group ?? reorderGroup),
                orientation: reorderOptions.orientation,
              })
            : undefined

          onDropPayload(payload, event, reorderDetails)
        }
      }}
      {...props}
    />
  )
}

export { DraggableItem, DropZone, readDragPayload }
