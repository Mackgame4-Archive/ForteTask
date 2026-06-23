import { format, isValid, parse, parseISO } from "date-fns"
import type { Locale } from "date-fns"
import { enUS, pt } from "date-fns/locale"

import Config from "@/lib/config"

const fallbackDateLocale = enUS
const dateLocales: Record<string, Locale> = {
  en: enUS,
  "en-US": enUS,
  pt,
  "pt-PT": pt,
}

function normalizeLanguage(value: string) {
  return value.trim()
}

export function getAppDateLocale(language = Config.APP_DEFAULT_LANG) {
  const normalizedLanguage = normalizeLanguage(language)
  const baseLanguage = normalizedLanguage.split("-")[0] ?? ""

  return (
    dateLocales[normalizedLanguage] ??
    dateLocales[baseLanguage] ??
    fallbackDateLocale
  )
}

export const appDateLocale = getAppDateLocale()

export const dateInputPattern = /^\d{2}-\d{2}-\d{4}$/ // dd-MM-yyyy format
export const timeInputPattern = /^([01]\d|2[0-3]):[0-5]\d$/ // HH:mm format

export function padTimePart(value: number) {
  return String(value).padStart(2, "0")
}

export const hourOptions = Array.from({ length: 24 }, (_, index) =>
  padTimePart(index)
)

export const minuteOptions = Array.from({ length: 60 }, (_, index) =>
  padTimePart(index)
)

export function formatDateInputValue(date: Date | null | undefined) {
  if (!date) {
    return ""
  }

  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()

  return `${day}-${month}-${year}`
}

export function parseDateValue(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value : parseISO(value)
}

export function formatTimeInputValue(
  date: Date | null | undefined,
  fallback = "09:00"
) {
  if (!date) {
    return fallback
  }

  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${hours}:${minutes}`
}

export function formatDateInputText(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)

  return [day, month, year].filter(Boolean).join("-")
}

export function formatTimeInputText(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4)
  const hours = digits.slice(0, 2)
  const minutes = digits.slice(2, 4)

  return [hours, minutes].filter(Boolean).join(":")
}

export function parseDateInputValue(value: string, inputFormat = "dd-MM-yyyy") {
  const parsed = parse(value, inputFormat, new Date())

  return isValid(parsed) ? parsed : undefined
}

export function formatAppDate(
  date: Date,
  formatString: string,
  locale = appDateLocale
) {
  return format(date, formatString, { locale })
}

export function combineDateAndTimeInput(
  date?: string,
  time = "00:00"
) {
  if (!dateInputPattern.test(date ?? "")) {
    return undefined
  }

  const [day, month, year] = date!.split("-").map(Number)
  const [hours = "0", minutes = "0"] = time.split(":")

  return new Date(
    year,
    month - 1,
    day,
    Number(hours),
    Number(minutes),
    0,
    0
  )
}

export function getDefaultDobRange() {
  const endMonth = new Date()
  const startMonth = new Date(endMonth.getFullYear() - 120, 0)

  return { startMonth, endMonth }
}
