import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { DataSet, ColumnInfo } from "@/types";
import { generateSessionId, saveDataSet } from "./store";

export function parseUploadedFile(
  fileName: string,
  buffer: Buffer
): DataSet {
  const lower = fileName.toLowerCase();
  let rows: Record<string, unknown>[] = [];
  let rawCsv = "";

  if (lower.endsWith(".csv")) {
    rawCsv = buffer.toString("utf-8");
    const result = Papa.parse<Record<string, unknown>>(rawCsv, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    rows = result.data;
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: true,
      defval: null,
    });
    rawCsv = XLSX.utils.sheet_to_csv(sheet);
  } else {
    throw new Error(`Unsupported file type: ${fileName}`);
  }

  if (rows.length === 0) {
    throw new Error("File is empty or has no data rows");
  }

  const columns = analyzeColumns(rows);
  const sessionId = generateSessionId();
  const dataSet: DataSet = {
    sessionId,
    fileName,
    rawCsv,
    columns,
    rows,
    rowCount: rows.length,
  };

  saveDataSet(sessionId, dataSet);
  return dataSet;
}

function analyzeColumns(rows: Record<string, unknown>[]): ColumnInfo[] {
  if (rows.length === 0) return [];

  const allKeys = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((k) => allKeys.add(k)));

  return Array.from(allKeys).map((key) => {
    const values = rows.map((r) => r[key]);
    const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
    const nullCount = values.length - nonNull.length;
    const uniqueValues = new Set(nonNull.map(String));

    let type: ColumnInfo["type"] = "string";
    if (nonNull.length > 0) {
      const allNumbers = nonNull.every(
        (v) => typeof v === "number" || (!isNaN(Number(v)) && v !== "")
      );
      const allBooleans = nonNull.every(
        (v) => typeof v === "boolean" || v === "true" || v === "false" || v === "True" || v === "False"
      );
      if (allBooleans) {
        type = "boolean";
      } else if (allNumbers) {
        type = "number";
      } else {
        const dateSample = nonNull.slice(0, 10);
        const allDates = dateSample.every((v) => !isNaN(Date.parse(String(v))));
        if (allDates && nonNull.length > 0) {
          type = "date";
        }
      }
    }

    return {
      name: key,
      type,
      sample: nonNull.slice(0, 5),
      nullCount,
      uniqueCount: uniqueValues.size,
    };
  });
}
