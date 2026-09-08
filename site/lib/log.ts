import { deploymentOf } from "./env";

/**
 * Structured logs, so a production incident can be read rather than guessed at.
 *
 * There were 46 `console.error("something failed", error)` calls across this
 * codebase. Each one is fine on its own and useless in aggregate: the message
 * is prose, the error object stringifies differently depending on where it came
 * from, and nothing carries the one field you actually want at 2am — which
 * record, in which deployment, and how many times.
 *
 * Vercel, and every other host worth using, parses a JSON line on stdout into
 * queryable fields. So a log line here is an object with a stable `event` name
 * you can filter on and count, not a sentence.
 *
 * What must never appear in one: a contact detail, a token, a form answer.
 * Logs are read by more people, in more places, than the database is — this is
 * the same reasoning that keeps the Diagnostics page reporting shapes rather
 * than data. `fields()` is deliberately typed to reject an unknown object so
 * that spreading a whole row into a log is a compile error rather than a habit.
 */

export type LogLevel = "error" | "warn" | "info";

/** Values a log field may hold. Nothing nested, so nothing leaks by accident. */
export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogValue>;

/**
 * The shape of a Supabase or Postgres error, reduced to the parts that identify
 * a fault. The message is included; the returned rows and the query are not.
 */
export type ErrorLike = { message?: string; code?: string | number } | null | undefined;

export function errorFields(error: ErrorLike, prefix = "error"): LogFields {
  if (!error) return {};
  return {
    [`${prefix}_code`]: error.code ?? null,
    // Bounded: a Postgres error can carry a whole statement, and a log line
    // that wraps for forty lines is one nobody reads to the end of.
    [`${prefix}_message`]: (error.message ?? "").slice(0, 300) || null,
  };
}

/** Turns a thrown value of unknown type into loggable fields. */
export function thrownFields(thrown: unknown, prefix = "error"): LogFields {
  if (thrown instanceof Error) {
    return {
      [`${prefix}_name`]: thrown.name,
      [`${prefix}_message`]: thrown.message.slice(0, 300),
    };
  }
  return { [`${prefix}_message`]: String(thrown).slice(0, 300) };
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    event,
    deployment: deploymentOf(),
    at: new Date().toISOString(),
    ...fields,
  });

  // console.error for error and warn so the host routes them to its error
  // stream; anything less loses them in a quiet log view during an incident.
  if (level === "info") console.log(line);
  else console.error(line);
}

/** Something went wrong that a person needs to know about. */
export function logError(event: string, fields: LogFields = {}): void {
  emit("error", event, fields);
}

/**
 * Something is degraded but working — a read that failed and fell back, a
 * message that was held rather than sent.
 */
export function logWarn(event: string, fields: LogFields = {}): void {
  emit("warn", event, fields);
}

/**
 * A fact worth counting later: how many messages a worker run sent, how often a
 * deployment refused a staging recipient. Deliberately sparse — an info log per
 * request is a bill, not an observation.
 */
export function logInfo(event: string, fields: LogFields = {}): void {
  emit("info", event, fields);
}

/**
 * A public read that could not be served.
 *
 * Its own function because these share one meaning and one response: the page
 * shows "unavailable" rather than zero, and the count of them over time is the
 * signal that something is wrong with the database rather than with one page.
 * Every `ReadResult` failure in lib/ routes through here.
 */
export function logReadFailure(source: string, error: ErrorLike): void {
  logError("public_read_failed", { source, ...errorFields(error) });
}
