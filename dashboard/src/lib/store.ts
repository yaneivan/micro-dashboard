import type { DataSet } from "@/types";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), ".sessions");

function ensureDir() {
  const { mkdirSync } = require("fs");
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sessionPath(sessionId: string): string {
  return join(DATA_DIR, `${sessionId}.json`);
}

export function saveDataSet(sessionId: string, data: DataSet): void {
  ensureDir();
  const payload = JSON.stringify(data);
  writeFileSync(sessionPath(sessionId), payload, "utf-8");
}

export function getDataSet(sessionId: string): DataSet | undefined {
  const p = sessionPath(sessionId);
  if (!existsSync(p)) return undefined;
  try {
    const raw = readFileSync(p, "utf-8");
    return JSON.parse(raw) as DataSet;
  } catch {
    return undefined;
  }
}

export function deleteDataSet(sessionId: string): boolean {
  const p = sessionPath(sessionId);
  if (existsSync(p)) {
    unlinkSync(p);
    return true;
  }
  return false;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
