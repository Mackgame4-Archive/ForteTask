"use client"

import * as React from "react"
import type { Locale } from "date-fns"
import { CalendarIcon, ChevronDownIcon, ClockIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  appDateLocale,
  dateInputPattern,
  formatAppDate,
  formatDateInputText,
  formatDateInputValue,
  formatTimeInputText,
  getDefaultDobRange,
  hourOptions,
  minuteOptions,
  parseDateInputValue,
  timeInputPattern,
} from "@/lib/utils/date"
import { cn } from "@/lib/utils"

type DatePickerValue = Date | DateRange | undefined

type DateInputDraft = {
  key: string
  value: string
}

type DatePickerProps = {
  id?: string
  name?: string
  fromName?: string
  toName?: string
  timeName?: string
  label?: string
  timeLabel?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  locale?: Locale
  align?: React.ComponentProps<typeof PopoverContent>["align"]
  formatString?: string
  inputFormat?: string
  defaultTime?: string
  value?: DatePickerValue
  defaultValue?: DatePickerValue
  onChange?: (value: DatePickerValue) => void
  dob?: boolean
  input?: boolean
  range?: boolean
  time?: boolean
  captionLayout?: React.ComponentProps<typeof Calendar>["captionLayout"]
  numberOfMonths?: number
  startMonth?: Date
  endMonth?: Date
}

function isDateRange(value: DatePickerValue): value is DateRange {
  return Boolean(value && !(value instanceof Date) && "from" in value)
}

function formatDate(
  date: Date | undefined,
  formatString = "PPP",
  locale = appDateLocale
) {
  return date ? formatAppDate(date, formatString, locale) : ""
}

function getDateKey(date: Date | undefined) {
  return date?.getTime().toString() ?? ""
}

function DatePicker({
  id,
  name,
  fromName,
  toName,
  timeName,
  label,
  timeLabel = "Hora",
  placeholder,
  className,
  disabled,
  required,
  locale,
  align = "start",
  formatString,
  inputFormat = "dd-MM-yyyy",
  defaultTime = "09:00",
  value,
  defaultValue,
  onChange,
  dob,
  input,
  range,
  time,
  captionLayout = "dropdown",
  numberOfMonths,
  startMonth,
  endMonth,
}: DatePickerProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const selectedValue = value ?? internalValue
  const selectedDate = selectedValue instanceof Date ? selectedValue : undefined
  const selectedRange = isDateRange(selectedValue) ? selectedValue : undefined
  const dobRange = dob ? getDefaultDobRange() : undefined
  const calendarStartMonth = startMonth ?? dobRange?.startMonth
  const calendarEndMonth = endMonth ?? dobRange?.endMonth
  const calendarLocale = locale ?? appDateLocale

  const selectedDateKey = getDateKey(selectedDate)
  const selectedRangeFromKey = getDateKey(selectedRange?.from)
  const selectedRangeToKey = getDateKey(selectedRange?.to)
  const [dateInputDraft, setDateInputDraft] =
    React.useState<DateInputDraft | null>(null)
  const [fromInputDraft, setFromInputDraft] =
    React.useState<DateInputDraft | null>(null)
  const [toInputDraft, setToInputDraft] =
    React.useState<DateInputDraft | null>(null)
  const [timeValue, setTimeValue] = React.useState(defaultTime)
  const dateInput =
    dateInputDraft?.key === selectedDateKey
      ? dateInputDraft.value
      : formatDateInputValue(selectedDate)
  const fromInput =
    fromInputDraft?.key === selectedRangeFromKey
      ? fromInputDraft.value
      : formatDateInputValue(selectedRange?.from)
  const toInput =
    toInputDraft?.key === selectedRangeToKey
      ? toInputDraft.value
      : formatDateInputValue(selectedRange?.to)

  function setDatePickerValue(nextValue: DatePickerValue) {
    setInternalValue(nextValue)
    onChange?.(nextValue)
  }

  function handleDateInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = formatDateInputText(event.target.value)

    setDateInputDraft({ key: selectedDateKey, value: nextValue })

    if (!nextValue) {
      setDatePickerValue(undefined)
      return
    }

    const parsedDate = parseDateInputValue(nextValue, inputFormat)
    if (parsedDate) {
      setDatePickerValue(parsedDate)
    }
  }

  function handleRangeInputChange(
    key: "from" | "to",
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const nextValue = formatDateInputText(event.target.value)
    const nextRange = {
      from: selectedRange?.from,
      to: selectedRange?.to,
    }

    if (key === "from") {
      setFromInputDraft({ key: selectedRangeFromKey, value: nextValue })
    } else {
      setToInputDraft({ key: selectedRangeToKey, value: nextValue })
    }

    if (!nextValue) {
      setDatePickerValue({ ...nextRange, [key]: undefined })
      return
    }

    const parsedDate = nextValue
      ? parseDateInputValue(nextValue, inputFormat)
      : undefined

    if (!parsedDate) {
      return
    }

    setDatePickerValue({ ...nextRange, [key]: parsedDate })
  }

  function handleTimeInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    setTimeValue(formatTimeInputText(event.target.value))
  }

  function setTimePart(part: "hour" | "minute", value: string) {
    const [currentHour = "09", currentMinute = "00"] = timeValue.split(":")

    setTimeValue(
      part === "hour"
        ? `${value}:${currentMinute}`
        : `${currentHour}:${value}`
    )
  }

  const singlePlaceholder = placeholder ?? "Pick a date"
  const rangePlaceholder = placeholder ?? "Pick a date range"
  const buttonLabel = range
    ? selectedRange?.from && selectedRange?.to
      ? `${formatDate(
          selectedRange.from,
          formatString ?? "LLL dd, y",
          calendarLocale
        )} - ${formatDate(selectedRange.to, formatString ?? "LLL dd, y", calendarLocale)}`
      : selectedRange?.from
        ? formatDate(selectedRange.from, formatString ?? "LLL dd, y", calendarLocale)
        : rangePlaceholder
    : selectedDate
      ? formatDate(selectedDate, formatString ?? "PPP", calendarLocale)
      : singlePlaceholder

  return (
    <div className={cn("grid gap-2", className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className={cn("flex gap-2", input && range ? "items-end" : "items-center")}>
        {input ? (
          range ? (
            <>
              <div className="grid flex-1 gap-2">
                <Label htmlFor={id ? `${id}-from` : undefined}>De</Label>
                <InputGroup>
                  <InputGroupInput
                    id={id ? `${id}-from` : undefined}
                    name={fromName}
                    type="text"
                    inputMode="numeric"
                    pattern={dateInputPattern.source}
                    maxLength={10}
                    value={fromInput}
                    onChange={(event) => handleRangeInputChange("from", event)}
                    placeholder={inputFormat.toLowerCase()}
                    disabled={disabled}
                    required={required}
                  />
                  <InputGroupAddon align="inline-end">
                    <Popover>
                      <PopoverTrigger
                        render={
                          <InputGroupButton
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={disabled}
                            aria-label="Pick a date range"
                          />
                        }
                      >
                        <CalendarIcon />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align={align}>
                        <Calendar
                          mode="range"
                          selected={selectedRange}
                          onSelect={setDatePickerValue}
                          numberOfMonths={numberOfMonths ?? 2}
                          defaultMonth={selectedRange?.from}
                          captionLayout={captionLayout}
                          startMonth={calendarStartMonth}
                          endMonth={calendarEndMonth}
                          locale={calendarLocale}
                        />
                      </PopoverContent>
                    </Popover>
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <div className="grid flex-1 gap-2">
                <Label htmlFor={id ? `${id}-to` : undefined}>Até</Label>
                <InputGroup>
                  <InputGroupInput
                    id={id ? `${id}-to` : undefined}
                    name={toName}
                    type="text"
                    inputMode="numeric"
                    pattern={dateInputPattern.source}
                    maxLength={10}
                    value={toInput}
                    onChange={(event) => handleRangeInputChange("to", event)}
                    placeholder={inputFormat.toLowerCase()}
                    disabled={disabled}
                    required={required}
                  />
                  <InputGroupAddon align="inline-end">
                    <Popover>
                      <PopoverTrigger
                        render={
                          <InputGroupButton
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={disabled}
                            aria-label="Pick a date range"
                          />
                        }
                      >
                        <CalendarIcon />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align={align}>
                        <Calendar
                          mode="range"
                          selected={selectedRange}
                          onSelect={setDatePickerValue}
                          numberOfMonths={numberOfMonths ?? 2}
                          defaultMonth={selectedRange?.from}
                          captionLayout={captionLayout}
                          startMonth={calendarStartMonth}
                          endMonth={calendarEndMonth}
                          locale={calendarLocale}
                        />
                      </PopoverContent>
                    </Popover>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </>
          ) : (
            <InputGroup>
              <InputGroupInput
                id={id}
                name={name}
                type="text"
                inputMode="numeric"
                pattern={dateInputPattern.source}
                maxLength={10}
                value={dateInput}
                onChange={handleDateInputChange}
                placeholder={inputFormat.toLowerCase()}
                disabled={disabled}
                required={required}
              />
              <InputGroupAddon align="inline-end">
                <Popover>
                  <PopoverTrigger
                    render={
                      <InputGroupButton
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={disabled}
                        aria-label="Pick a date"
                      />
                    }
                  >
                    <CalendarIcon />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align={align}>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setDatePickerValue}
                      defaultMonth={selectedDate}
                      captionLayout={captionLayout}
                      startMonth={calendarStartMonth}
                      endMonth={calendarEndMonth}
                      locale={calendarLocale}
                    />
                  </PopoverContent>
                </Popover>
              </InputGroupAddon>
            </InputGroup>
          )
        ) : null}
        {!input ? (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  id={id}
                  type="button"
                  variant="outline"
                  size="default"
                  disabled={disabled}
                  data-empty={range ? !selectedRange?.from : !selectedDate}
                  className={cn(
                    range
                      ? "w-70 justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
                      : "w-53 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                  )}
                />
              }
            >
              <>
                {range ? <CalendarIcon /> : null}
                <span>{buttonLabel}</span>
                {!range ? <ChevronDownIcon data-icon="inline-end" /> : null}
              </>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align={align}>
              {range ? (
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={setDatePickerValue}
                  numberOfMonths={numberOfMonths ?? 2}
                  defaultMonth={selectedRange?.from}
                  captionLayout={captionLayout}
                  startMonth={calendarStartMonth}
                  endMonth={calendarEndMonth}
                  locale={calendarLocale}
                />
              ) : (
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setDatePickerValue}
                  defaultMonth={selectedDate}
                  captionLayout={captionLayout}
                  startMonth={calendarStartMonth}
                  endMonth={calendarEndMonth}
                  locale={calendarLocale}
                />
              )}
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
      {time ? (
        <div className="grid gap-2">
          <Label htmlFor={timeName}>{timeLabel}</Label>
          <InputGroup>
            <InputGroupInput
              id={timeName}
              type="text"
              inputMode="numeric"
              name={timeName}
              pattern={timeInputPattern.source}
              maxLength={5}
              value={timeValue}
              onChange={handleTimeInputChange}
              placeholder="hh:mm"
              disabled={disabled}
            />
            <InputGroupAddon align="inline-end">
              <Popover>
                <PopoverTrigger
                  render={
                    <InputGroupButton
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={disabled}
                      aria-label="Pick a time"
                    />
                  }
                >
                  <ClockIcon />
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align={align}>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <div className="px-1 text-xs font-medium text-muted-foreground">
                        Hora
                      </div>
                      <div className="grid max-h-48 grid-cols-3 gap-1 overflow-y-auto pr-1">
                        {hourOptions.map((hour) => (
                          <Button
                            key={hour}
                            type="button"
                            variant={
                              timeValue.startsWith(`${hour}:`)
                                ? "secondary"
                                : "ghost"
                            }
                            size="xs"
                            onClick={() => setTimePart("hour", hour)}
                          >
                            {hour}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="px-1 text-xs font-medium text-muted-foreground">
                        Minuto
                      </div>
                      <div className="grid max-h-48 grid-cols-3 gap-1 overflow-y-auto pr-1">
                        {minuteOptions.map((minute) => (
                          <Button
                            key={minute}
                            type="button"
                            variant={
                              timeValue.endsWith(`:${minute}`)
                                ? "secondary"
                                : "ghost"
                            }
                            size="xs"
                            onClick={() => setTimePart("minute", minute)}
                          >
                            {minute}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </InputGroupAddon>
          </InputGroup>
        </div>
      ) : null}
    </div>
  )
}

function SingleDatePicker(props: DatePickerProps) {
  return <DatePicker {...props} />
}

function DateRangePicker(props: DatePickerProps) {
  return <DatePicker {...props} range />
}

function DateOfBirthPicker(props: DatePickerProps) {
  return <DatePicker {...props} dob />
}

function DateInputPicker(props: DatePickerProps) {
  return <DatePicker {...props} input />
}

function DateTimePicker(props: DatePickerProps) {
  return <DatePicker {...props} time />
}

export type { DateRange }

export {
  DateInputPicker,
  DateOfBirthPicker,
  DatePicker,
  DateRangePicker,
  DateTimePicker,
  SingleDatePicker,
}
