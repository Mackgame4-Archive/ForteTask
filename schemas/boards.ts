import { z } from "zod";

import { BoardCustomFieldType } from "@/generated/prisma/enums";
import {
  combineDateAndTimeInput,
  dateInputPattern,
  timeInputPattern,
} from "@/lib/utils/date";

function createSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const optionalDateSchema = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().regex(dateInputPattern).optional()
);
const optionalTimeSchema = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().regex(timeInputPattern).optional()
);
const labelNamesSchema = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          .split(/\r?\n|,/)
          .map((label) => label.trim())
          .filter(Boolean)
      : Array.isArray(value)
        ? value
            .map((label) => String(label).trim())
            .filter(Boolean)
      : [],
  z.array(z.string().min(1).max(80)).max(50)
);
const labelIdsSchema = z.array(z.coerce.number().int().positive()).default([]);
const assigneeIdsSchema = z.array(z.coerce.number().int().positive()).default([]);
const boardCustomFieldTypes = Object.values(BoardCustomFieldType) as [
  BoardCustomFieldType,
  ...BoardCustomFieldType[],
];
const customFieldTypeSchema = z.enum(boardCustomFieldTypes);
const customFieldSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(80),
    type: customFieldTypeSchema,
    minValue: z.coerce.number().int().optional(),
    maxValue: z.coerce.number().int().optional(),
  })
  .transform((field) => ({
    ...field,
    slug: createSlug(field.name),
    minValue: field.type === "INTEGER" ? field.minValue : null,
    maxValue: field.type === "INTEGER" ? field.maxValue : null,
  }))
  .refine((field) => field.slug.length > 0, {
    path: ["slug"],
    message: "Enter a valid custom field name.",
  })
  .refine(
    (field) =>
      field.type === "STRING" ||
      (typeof field.minValue === "number" && typeof field.maxValue === "number"),
    {
      path: ["minValue"],
      message: "Integer custom fields require a min and max value.",
    }
  )
  .refine(
    (field) =>
      field.type === "STRING" ||
      (typeof field.minValue === "number" &&
        typeof field.maxValue === "number" &&
        field.minValue <= field.maxValue),
    {
      path: ["maxValue"],
      message: "Integer custom field min must be less than or equal to max.",
    }
  );
const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/);

export const boardSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional(),
    teamIds: z.array(z.coerce.number().int().positive()).min(1),
  })
  .transform((data) => ({
    name: data.name,
    slug: createSlug(data.name),
    description: data.description || null,
    teamIds: data.teamIds,
  }))
  .refine((data) => data.slug.length > 0, {
    path: ["slug"],
    message: "Enter a valid board name.",
  });

export const updateBoardSchema = z
  .object({
    boardId: z.coerce.number().int().positive(),
    name: z.string().trim().min(1).max(120),
    teamIds: z.array(z.coerce.number().int().positive()).min(1),
    labels: labelNamesSchema,
    customFields: z.array(customFieldSchema).max(50).default([]),
  })
  .transform((data) => ({
    boardId: data.boardId,
    name: data.name,
    slug: createSlug(data.name),
    teamIds: data.teamIds,
    labels: [...new Set(data.labels)],
    customFields: data.customFields,
  }))
  .refine((data) => data.slug.length > 0, {
    path: ["slug"],
    message: "Enter a valid board name.",
  });

const columnSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  color: colorSchema.default("#3b82f6"),
});
const columnTransform = (data: z.infer<typeof columnSchema>) => ({
  boardId: data.boardId,
  name: data.name,
  slug: createSlug(data.name),
  color: data.color,
});

export const createColumnSchema = columnSchema
  .transform((data) => ({
    ...columnTransform(data),
  }))
  .refine((data) => data.slug.length > 0, {
    path: ["slug"],
    message: "Enter a valid column name.",
  });

export const deleteColumnSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  columnId: z.coerce.number().int().positive(),
});

export const updateColumnSchema = columnSchema
  .extend({
    columnId: z.coerce.number().int().positive(),
  })
  .transform((data) => ({
    ...columnTransform(data),
    columnId: data.columnId,
  }))
  .refine((data) => data.slug.length > 0, {
    path: ["slug"],
    message: "Enter a valid column name.",
  });

export const createTaskSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  columnId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  startDate: optionalDateSchema,
  startTime: optionalTimeSchema,
  dueDate: optionalDateSchema,
  dueTime: optionalTimeSchema,
  labelIds: labelIdsSchema,
  assigneeIds: assigneeIdsSchema,
  customFieldValues: z.record(z.string(), z.string()).default({}),
}).transform((data) => ({
  ...data,
  startDate: combineDateAndTimeInput(data.startDate, data.startTime),
  dueDate: combineDateAndTimeInput(data.dueDate, data.dueTime),
}));

export const updateTaskSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
  columnId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  completed: z.preprocess((value) => value === "true", z.boolean()),
  startDate: optionalDateSchema,
  startTime: optionalTimeSchema,
  dueDate: optionalDateSchema,
  dueTime: optionalTimeSchema,
  labelIds: labelIdsSchema,
  assigneeIds: assigneeIdsSchema,
  customFieldValues: z.record(z.string(), z.string()).default({}),
}).transform((data) => ({
  ...data,
  startDate: combineDateAndTimeInput(data.startDate, data.startTime),
  dueDate: combineDateAndTimeInput(data.dueDate, data.dueTime),
}));

export const deleteTaskSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
});

export const toggleTaskCompletedSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
  completed: z.preprocess((value) => value === "true", z.boolean()),
});

export const updateTaskDatesSchema = z
  .object({
    boardId: z.coerce.number().int().positive(),
    taskId: z.coerce.number().int().positive(),
    edge: z.enum(["start", "end"]),
    targetDate: z.string().regex(dateInputPattern),
  })
  .transform((data) => ({
    ...data,
    targetDate: combineDateAndTimeInput(data.targetDate),
  }))
  .refine((data) => Boolean(data.targetDate), {
    path: ["targetDate"],
    message: "Choose a valid date.",
  });

export const moveTaskSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
  sourceColumnId: z.coerce.number().int().positive(),
  targetColumnId: z.coerce.number().int().positive(),
  sourceTaskIds: z.array(z.coerce.number().int().positive()).default([]),
  targetTaskIds: z.array(z.coerce.number().int().positive()).default([]),
});

export const moveColumnSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  columnId: z.coerce.number().int().positive(),
  columnIds: z.array(z.coerce.number().int().positive()).default([]),
});

export type BoardInput = z.infer<typeof boardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type DeleteColumnInput = z.infer<typeof deleteColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;
export type ToggleTaskCompletedInput = z.infer<typeof toggleTaskCompletedSchema>;
export type UpdateTaskDatesInput = z.infer<typeof updateTaskDatesSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;
