import type { DataSet } from "@/types";

function computeStats(data: DataSet): string {
  const numericCols = data.columns.filter((c) => c.type === "number");
  const lines: string[] = [];

  const numericValues: Record<string, number[]> = {};

  for (const col of numericCols) {
    const values = data.rows
      .map((r) => r[col.name])
      .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(Number);

    numericValues[col.name] = values;

    if (values.length === 0) continue;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const std = Math.sqrt(
      values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
    );

    lines.push(
      `  ${col.name}: min=${min}, max=${max}, mean=${mean.toFixed(2)}, median=${median}, Q1=${q1}, Q3=${q3}, std=${std.toFixed(2)}`
    );
  }

  // Correlations between numeric columns (top 5 by |r|)
  if (numericCols.length >= 2) {
    const correlations: { col1: string; col2: string; r: number }[] = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const c1 = numericCols[i].name;
        const c2 = numericCols[j].name;
        const v1 = numericValues[c1];
        const v2 = numericValues[c2];
        if (!v1 || !v2) continue;

        // Pair up values by row index where both exist
        const pairs: [number, number][] = [];
        for (const row of data.rows) {
          const a = Number(row[c1]);
          const b = Number(row[c2]);
          if (!isNaN(a) && !isNaN(b)) pairs.push([a, b]);
        }
        if (pairs.length < 3) continue;

        const n = pairs.length;
        const sx = pairs.reduce((s, [x]) => s + x, 0);
        const sy = pairs.reduce((s, [, y]) => s + y, 0);
        const sxy = pairs.reduce((s, [x, y]) => s + x * y, 0);
        const sx2 = pairs.reduce((s, [x]) => s + x * x, 0);
        const sy2 = pairs.reduce((s, [, y]) => s + y * y, 0);
        const num = n * sxy - sx * sy;
        const den = Math.sqrt((n * sx2 - sx ** 2) * (n * sy2 - sy ** 2));
        const r = den === 0 ? 0 : num / den;
        correlations.push({ col1: c1, col2: c2, r: Number(r.toFixed(3)) });
      }
    }
    correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const topCorr = correlations.slice(0, 5);
    if (topCorr.length > 0) {
      lines.push("");
      lines.push("  Top correlations:");
      for (const c of topCorr) {
        const strength = Math.abs(c.r) > 0.7 ? "strong" : Math.abs(c.r) > 0.4 ? "moderate" : "weak";
        lines.push(`    ${c.col1} <-> ${c.col2}: r=${c.r} (${strength})`);
      }
    }
  }

  const categoricalCols = data.columns.filter(
    (c) => c.type === "string" || c.type === "boolean"
  );
  for (const col of categoricalCols) {
    const counts: Record<string, number> = {};
    for (const row of data.rows) {
      const val = String(row[col.name] ?? "null");
      counts[val] = (counts[val] || 0) + 1;
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    lines.push(`  ${col.name} (top values): ${top}`);
  }

  // Cross-tab: if two categorical columns each have <= 10 unique values
  const smallCats = categoricalCols.filter((c) => c.uniqueCount <= 10);
  if (smallCats.length >= 2) {
    const c1 = smallCats[0];
    const c2 = smallCats[1];
    const cross: Record<string, Record<string, number>> = {};
    for (const row of data.rows) {
      const a = String(row[c1.name] ?? "null");
      const b = String(row[c2.name] ?? "null");
      if (!cross[a]) cross[a] = {};
      cross[a][b] = (cross[a][b] || 0) + 1;
    }
    const topCombos = Object.entries(cross)
      .flatMap(([k, vs]) =>
        Object.entries(vs).map(([k2, v]) => ({
          combo: `${k} x ${k2}`,
          count: v,
        }))
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((c) => `${c.combo}: ${c.count}`)
      .join(", ");
    lines.push(`  ${c1.name} x ${c2.name} (top combos): ${topCombos}`);
  }

  return lines.join("\n");
}

export function buildSystemPrompt(data: DataSet): string {
  const schemaPreview = data.columns
    .map(
      (c) =>
        `- ${c.name} (${c.type}, ${c.uniqueCount} unique, ${c.nullCount} nulls) sample: [${c.sample.map(String).join(", ")}]`
    )
    .join("\n");

  const rowsToShow = Math.min(data.rows.length, 20);
  const firstRows = data.rows.slice(0, rowsToShow);
  const csvPreview = firstRows
    .map((r) => data.columns.map((c) => String(r[c.name] ?? "")).join(" | "))
    .join("\n");
  const header = data.columns.map((c) => c.name).join(" | ");

  const stats = computeStats(data);

  return `LANGUAGE RULE (NON-NEGOTIABLE): Respond in the SAME language as the user's question. If the question is in Russian — respond in Russian. If in English — respond in English. All text, chart titles, axis labels — must match the user's language.

You are a senior data analyst. Answer the user's question about this dataset.

## Dataset: ${data.fileName}
Total rows: ${data.rowCount.toLocaleString()} | Columns: ${data.columns.length}

The Computed Statistics below are from ALL ${data.rowCount.toLocaleString()} rows. Use them for accurate charts.

## Schema
${schemaPreview}

## Sample rows (${rowsToShow} of ${data.rowCount.toLocaleString()})
${header}
${csvPreview}

## Computed Statistics (from ALL ${data.rowCount.toLocaleString()} rows)
${stats}

## Your task
Answer the user's question. Then create charts that directly answer the question.

### Step 1: Explore data (MAX 3 query_data calls)
Use query_data to get the specific numbers you need. For comparison questions:
- Use filter_stats to compare groups (e.g., platform=iOS vs platform=android)
- Use groupby to aggregate by category
- Get the actual numbers BEFORE creating charts

### Step 2: Call plan_tool
Provide:
- insight: 2-3 sentences answering the question directly with specific numbers
- charts_plan: list of 2-3 charts that ANSWER the question

### Step 3: Call create_chart (MAX 3 charts)
Charts must directly answer the question. For comparison questions:
- Use grouped bar charts (multiple traces on one chart)
- Put the comparison groups on the X axis
- NEVER show distributions with 20K+ nulls — filter them out first

Chart types:
- bar: categorical comparisons (PREFERRED for comparison questions)
- line: trends over time
- pie: composition (only if <8 categories)
- scatter: correlations between 2 numeric columns
- box: distributions by category

RULES:
- You CAN use markdown formatting: **bold**, *italic*, - lists.
- NEVER use markdown image syntax ![...](...) to show charts. NEVER use URLs to plotly CDN or any other CDN.
- ALWAYS create charts using the create_chart tool ONLY. No other way.
- Use the EXACT data from the rows above. Do NOT invent numbers.
- All labels/text in the SAME language as column names.
- Charts must be clean and premium (no visual noise).
- Include proper axis labels and titles.
- Return valid Plotly JSON (data array + layout object) via create_chart tool ONLY.`;
}

export function buildChatPrompt(data: DataSet, question: string): string {
  const schemaPreview = data.columns
    .map(
      (c) =>
        `- ${c.name} (${c.type}, ${c.uniqueCount} unique, ${c.nullCount} nulls) sample: [${c.sample.map(String).slice(0, 3).join(", ")}]`
    )
    .join("\n");

  const sampleRows = data.rows.slice(0, 10);
  const csvPreview = sampleRows
    .map((r) => data.columns.map((c) => String(r[c.name] ?? "")).join(" | "))
    .join("\n");
  const header = data.columns.map((c) => c.name).join(" | ");
  const stats = computeStats(data);

  return `LANGUAGE RULE (NON-NEGOTIABLE): Respond in the SAME language as the user's question. If the question is in Russian — respond in Russian. If in English — respond in English. All text, chart titles, axis labels — must match the user's language.

You are a data analyst. Answer the user's question about this dataset.

## Dataset: ${data.fileName}
Total rows: ${data.rowCount.toLocaleString()} | Columns: ${data.columns.length}

The Computed Statistics below are from ALL ${data.rowCount.toLocaleString()} rows.

## Schema
${schemaPreview}

## Sample rows (10 of ${data.rowCount.toLocaleString()})
${header}
${csvPreview}

## Computed Statistics (from ALL ${data.rowCount.toLocaleString()} rows)
${stats}

## Question
--- QUESTION START ---
${question}
--- QUESTION END ---

Answer the question directly using the statistics. If the information is not in the data, say so.
Be concise and specific. Use numbers when possible.

FORMATTING: You CAN use markdown formatting: **bold**, *italic*, - lists.
To explore data, use query_data tool: groupby, value_counts, filter_stats, correlation, describe, top_combos.
LIMITS: query_data MAX 3 calls, create_chart MAX 3, MAX 8 turns total.
To create charts, use create_chart tool with Plotly JSON.
For comparison questions: use grouped bar charts, compare groups side by side.
NEVER use markdown image syntax or URLs for charts.
ALWAYS create charts using the create_chart tool ONLY.`;
}
