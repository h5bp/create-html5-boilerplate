// @ts-check
import { inspect } from "node:util";

/**
 * @typedef {Object} DiagnosticContext
 * @property {string} [reason]
 * @property {string} [path]
 * @property {string} [version]
 * @property {string} [hint]
 * @property {string} [availableVersions]
 * @property {unknown} [error]
 */

/**
 * @param {{debug?: boolean}} [options]
 */
export function createLogger(options = {}) {
  const debugEnabled = () => Boolean(options.debug || process.env.DEBUG);

  /**
   * @param {string} message
   * @param {unknown} [details]
   */
  function debug(message, details) {
    if (!debugEnabled()) return;
    const formatted =
      details === undefined
        ? ""
        : `\n${inspect(details, { depth: 5, colors: false })}`;
    process.stderr.write(`Debug: ${message}${formatted}\n`);
  }

  /**
   * @param {string} message
   * @param {DiagnosticContext | Error} [context]
   */
  function error(message, context = {}) {
    const fields = context instanceof Error ? { error: context } : context;
    const reason =
      fields.reason ??
      (fields.error instanceof Error
        ? fields.error.message
        : fields.error === undefined
          ? undefined
          : String(fields.error));
    const lines = [
      fields.version && `Version: ${fields.version}`,
      fields.path && `Path: ${fields.path}`,
      reason && `Reason: ${reason}`,
      fields.hint && `Hint: ${fields.hint}`,
      fields.availableVersions &&
        `Available versions: ${fields.availableVersions}`,
    ].filter(Boolean);
    process.stderr.write(
      `${message}${lines.length ? `\n\n${lines.join("\n")}` : ""}\n`,
    );
    if (fields.error !== undefined) debug("Error details", fields.error);
  }

  /**
   * @param {string} message
   * @param {DiagnosticContext} [context]
   */
  function warn(message, context = {}) {
    const lines = [
      context.path && `Path: ${context.path}`,
      context.version && `Version: ${context.version}`,
      context.reason && `Reason: ${context.reason}`,
      context.hint && `Hint: ${context.hint}`,
    ].filter(Boolean);
    process.stderr.write(
      `Warning: ${message}${lines.length ? `\n\n${lines.join("\n")}` : ""}\n`,
    );
    if (context.error !== undefined) debug("Warning details", context.error);
  }

  /** @param {string} message */
  function info(message) {
    process.stdout.write(`${message}\n`);
  }

  return { error, warn, info, debug };
}

const args = process.argv.slice(2);
const terminator = args.indexOf("--");
const defaultLogger = createLogger({
  debug: args
    .slice(0, terminator < 0 ? undefined : terminator)
    .includes("--debug"),
});
export const { error, warn, info, debug } = defaultLogger;
