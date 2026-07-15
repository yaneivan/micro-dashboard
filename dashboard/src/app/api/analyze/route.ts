import { getDataSet } from "@/lib/store";
import { buildSystemPrompt } from "@/lib/prompts";
import { logger } from "@/lib/logger";
import { executeQuery, type QueryOperation } from "@/lib/data-query";
import type { ChartSpec } from "@/types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const tools = [
  {
    type: "function" as const,
    function: {
      name: "plan_tool",
      description:
        "Call this FIRST after analyzing the data. Provide your insight and which charts you will create.",
      parameters: {
        type: "object",
        properties: {
          insight: {
            type: "string",
            description:
              "2-3 sentence summary of the most important finding with specific numbers",
          },
          charts_plan: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Chart title" },
                type: {
                  type: "string",
                  enum: ["bar", "line", "pie", "scatter", "histogram", "box"],
                },
                reason: { type: "string", description: "Why this chart" },
              },
              required: ["title", "type", "reason"],
            },
            description: "Charts to create (2-3 max)",
          },
        },
        required: ["insight", "charts_plan"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_data",
      description:
        "Explore the dataset. Run aggregation, filtering, or statistical queries on the full data. Use this to verify hypotheses before creating charts.",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "object",
            description:
              'Query spec. Examples:\n{"op":"groupby","groupBy":"City","aggColumn":"Revenue","aggFunc":"mean"}\n{"op":"value_counts","column":"Category"}\n{"op":"filter_stats","column":"Status","operator":"eq","value":"Active","statsColumn":"Amount"}\n{"op":"correlation","columns":["Price","Quantity"]}\n{"op":"describe","column":"Age"}\n{"op":"top_combos","col1":"City","col2":"Category"}',
          },
        },
        required: ["operation"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_chart",
      description:
        "Create one interactive Plotly chart. Provide complete Plotly JSON with data and layout.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Chart title" },
          chart_type: {
            type: "string",
            enum: ["bar", "line", "pie", "scatter", "histogram", "box"],
          },
          plotly_json: {
            type: "object",
            description:
              'Complete Plotly spec: { "data": [...], "layout": {...} }',
            properties: {
              data: { type: "array", description: "Plotly data traces" },
              layout: { type: "object", description: "Plotly layout" },
            },
            required: ["data", "layout"],
          },
        },
        required: ["title", "chart_type", "plotly_json"],
      },
    },
  },
];

function executeTool(
  name: string,
  args: Record<string, unknown>,
  rows?: Record<string, unknown>[]
): unknown {
  logger.debug("tool", `Executing: ${name}`);
  if (name === "plan_tool") {
    logger.info("tool", `Insight: ${(args.insight as string)?.slice(0, 120)}...`);
    return args;
  }
  if (name === "query_data") {
    const operation = args.operation as QueryOperation;
    if (!rows) return { error: "No data available" };
    return executeQuery(rows, operation);
  }
  if (name === "create_chart") {
    logger.info("tool", `Chart: ${args.title} (${args.chart_type})`);
    const plotly = args.plotly_json as Record<string, unknown> | undefined;
    if (!plotly || !plotly.data || !plotly.layout) {
      logger.error("tool", `Invalid plotly_json: missing data or layout. Keys: ${Object.keys(args).join(", ")}`);
      logger.error("tool", `plotly_json value: ${JSON.stringify(args.plotly_json).slice(0, 500)}`);
      return { success: false, title: args.title, error: "Invalid plotly_json: missing data or layout" };
    }
    const data = plotly.data as unknown[];
    if (!Array.isArray(data) || data.length === 0) {
      logger.error("tool", `plotly_json.data is empty or not array: ${JSON.stringify(plotly.data).slice(0, 300)}`);
      return { success: false, title: args.title, error: "plotly_json.data is empty" };
    }
    logger.info("tool", `Chart valid: ${data.length} traces, layout keys: ${Object.keys(plotly.layout).join(", ")}`);
    return { success: true, title: args.title, chart: args.plotly_json };
  }
  return { result: "unknown tool" };
}

async function callOpenRouter(
  messages: Array<Record<string, unknown>>,
  toolsParam?: typeof tools,
  turn?: number,
  modelOverride?: string
): Promise<Record<string, unknown>> {
  const model = modelOverride || process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
  logger.info("openrouter", `Turn ${turn}: model=${model}`);

  const startTime = Date.now();

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://datalens.app",
      "X-Title": "DataLens",
    },
      body: JSON.stringify({
        model,
        messages,
        tools: toolsParam,
        max_tokens: 4096,
        reasoning: { effort: "high" },
      }),
  });

  const elapsed = Date.now() - startTime;
  logger.info("openrouter", `Turn ${turn}: ${res.status} in ${elapsed}ms`);

  if (!res.ok) {
    const err = await res.text();
    logger.error("openrouter", `Error ${res.status}: ${err}`);
    throw new Error(`OpenRouter API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.message?.tool_calls) {
    logger.info(
      "openrouter",
      `Turn ${turn}: ${choice.message.tool_calls.length} tool calls`
    );
  }

  return data;
}

export async function POST(request: Request) {
  const ctx = "analyze";
  try {
    const { sessionId, model: modelParam } = await request.json();
    logger.info(ctx, `=== Analysis started: ${sessionId} ===`);

    if (!sessionId) {
      return Response.json({ error: "sessionId required" }, { status: 400 });
    }

    const dataSet = getDataSet(sessionId);
    if (!dataSet) {
      logger.warn(ctx, `Session not found: ${sessionId}`);
      return Response.json(
        { error: "Session not found. Upload a file first." },
        { status: 404 }
      );
    }

    logger.info(
      ctx,
      `Dataset: ${dataSet.fileName}, ${dataSet.rowCount} rows, ${dataSet.columns.length} cols`
    );

    const systemPrompt = buildSystemPrompt(dataSet);
    logger.debug(ctx, `Prompt: ${systemPrompt.length} chars`);

    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Analyze this dataset. First call plan_tool with your insight, then call create_chart for each visualization.",
      },
    ];

    const allResults: Array<{ name: string; output: unknown }> = [];
    const reasoningSteps: string[] = [];
    const MAX_TURNS = 8;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      logger.info(ctx, `--- Turn ${turn + 1}/${MAX_TURNS} ---`);

      const response = await callOpenRouter(messages, tools, turn + 1, modelParam);
      const choice = (
        response as {
          choices?: Array<{ message: Record<string, unknown> }>;
        }
      ).choices?.[0];

      if (!choice) break;

      const assistantMsg = choice.message;

      const reasoning = (assistantMsg as Record<string, unknown>).reasoning_content;
      if (reasoning && typeof reasoning === "string" && reasoning.trim()) {
        reasoningSteps.push(reasoning.trim());
        logger.info("reasoning", `Turn ${turn + 1}: ${reasoning.slice(0, 120)}...`);
      }

      messages.push({
        role: "assistant",
        content: assistantMsg.content || "",
        tool_calls: assistantMsg.tool_calls,
      });

      const toolCalls = assistantMsg.tool_calls as
        | Array<{
            id: string;
            function: { name: string; arguments: string };
          }>
        | undefined;

      if (!toolCalls || toolCalls.length === 0) {
        logger.info(ctx, "No tool calls — done");
        break;
      }

      for (const tc of toolCalls) {
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(tc.function.arguments);
        } catch {
          logger.warn(ctx, `Failed to parse args for ${tc.function.name}`);
        }

        if (tc.function.name === "plan_tool" && allResults.some((r) => r.name === "plan_tool")) {
          logger.warn(ctx, "Duplicate plan_tool — skipping");
          messages.push({ role: "tool", content: JSON.stringify({ skipped: true }), tool_call_id: tc.id });
          continue;
        }

        const queryCount = allResults.filter((r) => r.name === "query_data").length;
        if (tc.function.name === "query_data" && queryCount >= 3) {
          logger.warn(ctx, `query_data limit reached (${queryCount}) — blocking`);
          messages.push({
            role: "tool",
            content: JSON.stringify({ error: "LIMIT REACHED: You already used all 3 query_data calls. Now create your charts with the data you have." }),
            tool_call_id: tc.id,
          });
          continue;
        }

        const output = executeTool(tc.function.name, fnArgs, dataSet.rows);
        allResults.push({ name: tc.function.name, output });

        messages.push({
          role: "tool",
          content: JSON.stringify(output),
          tool_call_id: tc.id,
        });
      }

      const chartCount = allResults.filter(
        (r) => r.name === "create_chart"
      ).length;
      if (chartCount >= 3) {
        logger.info(ctx, `${chartCount} charts — stopping`);
        break;
      }

      const queryCount = allResults.filter(
        (r) => r.name === "query_data"
      ).length;
      if (queryCount >= 3) {
        logger.info(ctx, `${queryCount} queries — limit reached`);
      }
    }

    logger.info(ctx, `Processing ${allResults.length} results`);

    const charts: ChartSpec[] = [];
    let insight = "";

    for (const r of allResults) {
      if (r.name === "plan_tool") {
        const out = r.output as { insight: string };
        insight = out.insight;
      }
      if (r.name === "create_chart") {
        const out = r.output as { title: string; chart: unknown; success: boolean; error?: string };
        if (out.success === false) {
          logger.warn("analyze", `Skipping invalid chart "${out.title}": ${out.error}`);
        } else if (out.chart) {
          charts.push({ ...(out.chart as ChartSpec), title: out.title });
        }
      }
    }

    const lastAssistant = messages
      .filter((m) => m.role === "assistant")
      .pop();
    const summary = (lastAssistant?.content as string) || "";

    if (!insight && summary) {
      insight = summary.slice(0, 500);
    }

    if (!insight && charts.length === 0) {
      insight = `Проанализировано ${dataSet.rowCount} строк, ${dataSet.columns.length} колонок.`;
    }

    logger.info(
      ctx,
      `=== Done: ${charts.length} charts, insight: ${insight.slice(0, 80)}... ===`
    );

    return Response.json({ insight, charts, code: "", summary, reasoning: reasoningSteps });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(ctx, `Failed: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}
