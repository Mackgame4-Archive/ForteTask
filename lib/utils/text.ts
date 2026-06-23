const mojibakePattern = /(?:\u00c3|\u00c2|\u00e2\u20ac)/;
const defaultDateOnlyPattern =
  /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/;
const defaultDateTimePattern =
  /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const trueValues = new Set([
  "1",
  "active",
  "ativo",
  "checked",
  "enabled",
  "ligado",
  "ok",
  "on",
  "s",
  "sim",
  "t",
  "true",
  "v",
  "verdade",
  "verdadeiro",
  "x",
  "y",
  "yes",
]);
const falseValues = new Set([
  "0",
  "disabled",
  "desativado",
  "desligado",
  "f",
  "false",
  "falso",
  "inactive",
  "inativo",
  "n",
  "nao",
  "não",
  "no",
  "off",
]);

export type DateParts = {
  day: number;
  hours?: number;
  minutes?: number;
  month: number;
  seconds?: number;
  year: number;
};
export type DateTextMatcher = (value: string) => DateParts | null;

function cleanNumberText(value: unknown) {
  return normalizeMojibakeText(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[€$£]/g, "");
}

function decodeLatin1AsUtf8(text: string) {
  const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff);

  return new TextDecoder("utf-8").decode(bytes);
}

export function normalizeMojibakeText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);

  for (let index = 0; index < 3 && mojibakePattern.test(text); index += 1) {
    const decoded = decodeLatin1AsUtf8(text);

    if (decoded === text || decoded.includes("\uFFFD")) {
      break;
    }

    text = decoded;
  }

  return text;
}

export function parseText(value: unknown) {
  const normalized = normalizeMojibakeText(value).trim();

  return normalized || null;
}

export function parseBooleanText(value: unknown) {
  const normalized = normalizeMojibakeText(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (trueValues.has(normalized)) {
    return true;
  }

  if (falseValues.has(normalized)) {
    return false;
  }

  return null;
}

export function parseIntegerText(value: unknown) {
  const normalized = cleanNumberText(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized.replace(/[.,](?=\d{3}\b)/g, ""), 10);

  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDecimalText(value: unknown) {
  const normalized = cleanNumberText(value);

  if (!normalized) {
    return null;
  }

  const decimalSeparator = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
    ? ","
    : ".";
  const thousandsSeparator = decimalSeparator === "," ? "." : ",";
  const decimalText = normalized
    .replaceAll(thousandsSeparator, "")
    .replace(decimalSeparator, ".");
  const parsed = Number(decimalText);

  return Number.isFinite(parsed) ? decimalText : null;
}

export function matchDayMonthYearDateText(value: string) {
  const match = value.match(defaultDateOnlyPattern);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;

  return {
    day: Number(day),
    month: Number(month),
    year: Number(year),
  };
}

export function matchDayMonthYearDateTimeText(value: string) {
  const match = value.match(defaultDateTimePattern);

  if (!match) {
    return null;
  }

  const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] = match;

  return {
    day: Number(day),
    hours: Number(hours),
    minutes: Number(minutes),
    month: Number(month),
    seconds: Number(seconds),
    year: Number(year),
  };
}

export function parseDateText(
  value: unknown,
  matchDateText: DateTextMatcher = matchDayMonthYearDateText
) {
  const normalized = normalizeMojibakeText(value).trim();

  if (!normalized) {
    return null;
  }

  const dateParts = matchDateText(normalized);

  if (dateParts) {
    return new Date(
      Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)
    );
  }

  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDateTimeText(
  value: unknown,
  matchDateTimeText: DateTextMatcher = matchDayMonthYearDateTimeText
) {
  const normalized = normalizeMojibakeText(value).trim();

  if (!normalized) {
    return null;
  }

  const dateParts = matchDateTimeText(normalized);

  if (dateParts) {
    return new Date(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      dateParts.hours ?? 0,
      dateParts.minutes ?? 0,
      dateParts.seconds ?? 0
    );
  }

  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
