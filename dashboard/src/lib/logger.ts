type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";

function formatTime(): string {
  return new Date().toISOString().slice(11, 23);
}

function log(level: LogLevel, context: string, message: string, data?: unknown) {
  const color = LEVEL_COLORS[level];
  const tag = level.toUpperCase().padEnd(5);
  const prefix = `${color}[${formatTime()}] ${tag}${RESET} [${context}]`;
  console.log(`${prefix} ${message}`);
  if (data !== undefined) {
    console.log(`${prefix}`, data);
  }
}

export const logger = {
  debug: (ctx: string, msg: string, data?: unknown) => log("debug", ctx, msg, data),
  info: (ctx: string, msg: string, data?: unknown) => log("info", ctx, msg, data),
  warn: (ctx: string, msg: string, data?: unknown) => log("warn", ctx, msg, data),
  error: (ctx: string, msg: string, data?: unknown) => log("error", ctx, msg, data),
};
