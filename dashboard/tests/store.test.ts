import { saveDataSet, getDataSet, deleteDataSet, generateSessionId } from "@/lib/store";
import type { DataSet } from "@/types";

function makeDataSet(sessionId: string): DataSet {
  return {
    sessionId,
    fileName: "test.csv",
    rawCsv: "a,b\n1,2",
    columns: [
      { name: "a", type: "number", sample: [1], nullCount: 0, uniqueCount: 1 },
      { name: "b", type: "number", sample: [2], nullCount: 0, uniqueCount: 1 },
    ],
    rows: [{ a: 1, b: 2 }],
    rowCount: 1,
  };
}

describe("store", () => {
  it("saves and retrieves data", () => {
    const ds = makeDataSet("test-1");
    saveDataSet("test-1", ds);
    const retrieved = getDataSet("test-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe("test-1");
    expect(retrieved?.rowCount).toBe(1);
  });

  it("returns undefined for missing session", () => {
    const retrieved = getDataSet("nonexistent");
    expect(retrieved).toBeUndefined();
  });

  it("deletes data", () => {
    saveDataSet("test-del", makeDataSet("test-del"));
    expect(getDataSet("test-del")).toBeDefined();

    const deleted = deleteDataSet("test-del");
    expect(deleted).toBe(true);
    expect(getDataSet("test-del")).toBeUndefined();
  });

  it("generates unique session IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }
    expect(ids.size).toBe(100);
  });
});
