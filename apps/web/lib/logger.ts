import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

let counter = 0;

export function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const seq = (counter++).toString(36);
  return `${ts}-${seq}`;
}
