export class AppError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class DatabaseConnectionError extends AppError {
  static readonly code = "NO_DATABASE_CONNECTION";
  static readonly defaultMessage =
    "No database connection found. Check DATABASE_URL and that Postgres is running.";

  constructor(message = DatabaseConnectionError.defaultMessage) {
    super(DatabaseConnectionError.code, message);
    this.name = "DatabaseConnectionError";
  }

  static warn() {
    console.warn(DatabaseConnectionError.defaultMessage);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong."
) {
  return isRecord(error) && typeof error.message === "string"
    ? error.message
    : fallback;
}

export function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof DatabaseConnectionError) {
    return true;
  }

  if (!isRecord(error)) {
    return false;
  }

  const code = error.code;
  const message = error.message;
  const name = error.name;

  if (code === "ECONNREFUSED" || code === DatabaseConnectionError.code) {
    return true;
  }

  if (
    typeof message === "string" &&
    (message.includes("ECONNREFUSED") ||
      message.includes("Can't reach database server") ||
      message.includes("DATABASE_URL is required"))
  ) {
    return true;
  }

  if (
    typeof name === "string" &&
    (name === "PrismaClientInitializationError" ||
      name === "DatabaseConnectionError")
  ) {
    return true;
  }

  return isDatabaseConnectionError(error.cause);
}

export function warnIfDatabaseConnectionError(error: unknown): boolean {
  if (!isDatabaseConnectionError(error)) {
    return false;
  }

  DatabaseConnectionError.warn();
  return true;
}
