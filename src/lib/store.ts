import type { DataSet } from "@/types";

const inMemory = new Map<string, DataSet>();

let DATA_DIR: string | null = null;
let fsAvailable: boolean | null = null;

function getDir(): string | null {
  if (fsAvailable !== null) return DATA_DIR;
  try {
    const { existsSync, mkdirSync } = require("fs");
    const { join } = require("path");
    const dir = join(process.cwd(), ".sessions");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    DATA_DIR = dir;
    fsAvailable = true;
  } catch {
    fsAvailable = false;
  }
  return DATA_DIR;
}

export function saveDataSet(sessionId: string, data: DataSet): void {
  const dir = getDir();
  if (dir) {
    try {
      const { writeFileSync } = require("fs");
      const { join } = require("path");
      writeFileSync(join(dir, `${sessionId}.json`), JSON.stringify(data), "utf-8");
      return;
    } catch { /* fall through */ }
  }
  inMemory.set(sessionId, data);
}

export function getDataSet(sessionId: string): DataSet | undefined {
  const dir = getDir();
  if (dir) {
    try {
      const { readFileSync, existsSync } = require("fs");
      const { join } = require("path");
      const p = join(dir, `${sessionId}.json`);
      if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8")) as DataSet;
    } catch { /* fall through */ }
  }
  return inMemory.get(sessionId);
}

export function deleteDataSet(sessionId: string): boolean {
  const dir = getDir();
  if (dir) {
    try {
      const { existsSync, unlinkSync } = require("fs");
      const { join } = require("path");
      const p = join(dir, `${sessionId}.json`);
      if (existsSync(p)) { unlinkSync(p); return true; }
    } catch { /* fall through */ }
  }
  return inMemory.delete(sessionId);
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
