import { stdout } from "node:process";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  return Boolean(stdout.isTTY);
}

function paint(text: string, code: string): string {
  if (!supportsColor()) return text;
  return `${code}${text}${RESET}`;
}

export function bold(text: string): string {
  return paint(text, BOLD);
}

export function dim(text: string): string {
  return paint(text, DIM);
}

export function red(text: string): string {
  return paint(text, RED);
}

export function green(text: string): string {
  return paint(text, GREEN);
}

export function yellow(text: string): string {
  return paint(text, YELLOW);
}

export function cyan(text: string): string {
  return paint(text, CYAN);
}

export function isInteractiveTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
