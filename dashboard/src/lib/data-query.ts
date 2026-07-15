import { logger } from "./logger";

type AggFunc = "mean" | "sum" | "count" | "min" | "max" | "median";
type FilterOp = "eq" | "gt" | "lt" | "gte" | "lte" | "contains";

export type QueryOperation =
  | {
      op: "groupby";
      groupBy: string;
      aggColumn: string;
      aggFunc: AggFunc;
      limit?: number;
    }
  | { op: "value_counts"; column: string; limit?: number }
  | {
      op: "filter_stats";
      column: string;
      operator: FilterOp;
      value: string | number;
      statsColumn?: string;
    }
  | { op: "correlation"; columns: [string, string] }
  | { op: "describe"; column: string }
  | { op: "top_combos"; col1: string; col2: string; limit?: number };

function getNumericValues(
  rows: Record<string, unknown>[],
  col: string
): number[] {
  return rows
    .map((r) => r[col])
    .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
    .map(Number);
}

function computeBasicStats(values: number[]): Record<string, number> | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const std = Math.sqrt(
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  );

  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Number(mean.toFixed(4)),
    median,
    q1,
    q3,
    std: Number(std.toFixed(4)),
  };
}

function applyAgg(values: number[], func: AggFunc): number | null {
  if (values.length === 0) return null;
  const nums = values.filter((v) => !isNaN(v));
  if (nums.length === 0) return null;

  switch (func) {
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "mean":
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "count":
      return nums.length;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
    case "median": {
      const sorted = [...nums].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    }
  }
}

function matchesFilter(
  val: unknown,
  operator: FilterOp,
  target: string | number
): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val);
  const n = Number(val);
  const t = Number(target);

  switch (operator) {
    case "eq":
      return s === String(target) || (typeof val === "number" && n === t);
    case "gt":
      return !isNaN(n) && n > t;
    case "lt":
      return !isNaN(n) && n < t;
    case "gte":
      return !isNaN(n) && n >= t;
    case "lte":
      return !isNaN(n) && n <= t;
    case "contains":
      return s.toLowerCase().includes(String(target).toLowerCase());
    default:
      return false;
  }
}

function executeGroupBy(
  rows: Record<string, unknown>[],
  query: Extract<QueryOperation, { op: "groupby" }>
): Record<string, unknown> {
  const { groupBy, aggColumn, aggFunc, limit = 20 } = query;
  const groups: Record<string, number[]> = {};

  for (const row of rows) {
    const key = String(row[groupBy] ?? "null");
    if (!groups[key]) groups[key] = [];
    const raw = row[aggColumn];
    if (raw === null || raw === undefined || raw === "") continue;
    const val = Number(raw);
    if (!isNaN(val)) groups[key].push(val);
  }

  const result = Object.entries(groups)
    .map(([key, values]) => ({
      [groupBy]: key,
      [aggFunc]: applyAgg(values, aggFunc),
      _count: values.length,
    }))
    .sort((a, b) => (b[aggFunc] as number) - (a[aggFunc] as number))
    .slice(0, limit)
    .map(({ _count, ...rest }) => rest);

  return { operation: "groupby", groupBy, aggColumn, aggFunc, result };
}

function executeValueCounts(
  rows: Record<string, unknown>[],
  query: Extract<QueryOperation, { op: "value_counts" }>
): Record<string, unknown> {
  const { column, limit = 20 } = query;
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const val = String(row[column] ?? "null");
    counts[val] = (counts[val] || 0) + 1;
  }

  const result = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count, pct: Number(((count / rows.length) * 100).toFixed(1)) }));

  return { operation: "value_counts", column, total: rows.length, result };
}

function executeFilterStats(
  rows: Record<string, unknown>[],
  query: Extract<QueryOperation, { op: "filter_stats" }>
): Record<string, unknown> {
  const { column, operator, value, statsColumn } = query;
  const filtered = rows.filter((r) => matchesFilter(r[column], operator, value));

  const result: Record<string, unknown> = {
    operation: "filter_stats",
    filter: `${column} ${operator} ${value}`,
    matched: filtered.length,
    total: rows.length,
    pct: Number(((filtered.length / rows.length) * 100).toFixed(1)),
  };

  if (statsColumn) {
    const nums = getNumericValues(filtered, statsColumn);
    const stats = computeBasicStats(nums);
    if (stats) {
      result.column = statsColumn;
      result.stats = stats;
    }
  }

  // Also return value_counts for categorical columns if filter matched
  if (filtered.length > 0 && filtered.length <= 500) {
    const sample = filtered.slice(0, 100);
    result.samplePreview = sample.slice(0, 5);
  }

  return result;
}

function executeCorrelation(
  rows: Record<string, unknown>[],
  query: Extract<QueryOperation, { op: "correlation" }>
): Record<string, unknown> {
  const [col1, col2] = query.columns;
  const pairs: [number, number][] = [];

  for (const row of rows) {
    const a = Number(row[col1]);
    const b = Number(row[col2]);
    if (!isNaN(a) && !isNaN(b)) {
      pairs.push([a, b]);
    }
  }

  if (pairs.length < 3) {
    return {
      operation: "correlation",
      columns: [col1, col2],
      error: "Not enough numeric pairs (need at least 3)",
      pairsFound: pairs.length,
    };
  }

  const n = pairs.length;
  const sumX = pairs.reduce((s, [x]) => s + x, 0);
  const sumY = pairs.reduce((s, [, y]) => s + y, 0);
  const sumXY = pairs.reduce((s, [x, y]) => s + x * y, 0);
  const sumX2 = pairs.reduce((s, [x]) => s + x * x, 0);
  const sumY2 = pairs.reduce((s, [, y]) => s + y * y, 0);

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  const r = den === 0 ? 0 : num / den;

  return {
    operation: "correlation",
    columns: [col1, col2],
    pearson_r: Number(r.toFixed(4)),
    pairsFound: n,
    strength:
      Math.abs(r) > 0.7
        ? "strong"
        : Math.abs(r) > 0.4
          ? "moderate"
          : Math.abs(r) > 0.2
            ? "weak"
            : "negligible",
  };
}

function executeDescribe(
  rows: Record<string, unknown>[],
  query: Extract<QueryOperation, { op: "describe" }>
): Record<string, unknown> {
  const { column } = query;
  const values = getNumericValues(rows, column);
  const stats = computeBasicStats(values);

  if (!stats) {
    return { operation: "describe", column, error: "No numeric values found" };
  }

  // Add distribution buckets
  const sorted = [...values].sort((a, b) => a - b);
  const bucketCount = 5;
  const bucketSize = Math.ceil(sorted.length / bucketCount);
  const distribution = [];
  for (let i = 0; i < bucketCount && i * bucketSize < sorted.length; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, sorted.length);
    const bucket = sorted.slice(start, end);
    distribution.push({
      range: `${bucket[0]}-${bucket[bucket.length - 1]}`,
      count: bucket.length,
    });
  }

  return { operation: "describe", column, stats, distribution };
}

function executeTopCombos(
  rows: Record<string, unknown>[],
  query: Extract<QueryOperation, { op: "top_combos" }>
): Record<string, unknown> {
  const { col1, col2, limit = 15 } = query;
  const counts: Record<string, { combo: [string, string]; count: number }> =
    {};

  for (const row of rows) {
    const a = String(row[col1] ?? "null");
    const b = String(row[col2] ?? "null");
    const key = `${a}|||${b}`;
    if (!counts[key]) {
      counts[key] = { combo: [a, b], count: 0 };
    }
    counts[key].count++;
  }

  const result = Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ combo, count }) => ({
      [col1]: combo[0],
      [col2]: combo[1],
      count,
      pct: Number(((count / rows.length) * 100).toFixed(1)),
    }));

  return { operation: "top_combos", col1, col2, total: rows.length, result };
}

const MAX_RESULT_SIZE = 4000;

export function executeQuery(
  rows: Record<string, unknown>[],
  query: QueryOperation
): Record<string, unknown> {
  logger.info("data-query", `op=${query.op}`);

  let result: Record<string, unknown>;

  try {
    switch (query.op) {
      case "groupby":
        result = executeGroupBy(rows, query);
        break;
      case "value_counts":
        result = executeValueCounts(rows, query);
        break;
      case "filter_stats":
        result = executeFilterStats(rows, query);
        break;
      case "correlation":
        result = executeCorrelation(rows, query);
        break;
      case "describe":
        result = executeDescribe(rows, query);
        break;
      case "top_combos":
        result = executeTopCombos(rows, query);
        break;
      default:
        result = { error: `Unknown operation: ${(query as { op: string }).op}` };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("data-query", `Error: ${msg}`);
    result = { error: msg };
  }

  // Truncate if too large
  const json = JSON.stringify(result);
  if (json.length > MAX_RESULT_SIZE) {
    logger.warn("data-query", `Result truncated: ${json.length} -> ${MAX_RESULT_SIZE}`);
    return JSON.parse(json.slice(0, MAX_RESULT_SIZE) + '"...');
  }

  return result;
}
