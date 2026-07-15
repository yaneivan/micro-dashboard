import { buildSystemPrompt } from "@/lib/prompts";
import type { DataSet } from "@/types";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const mockDataset: DataSet = {
  sessionId: "test",
  fileName: "test.csv",
  rawCsv: "name,score\nAlice,95\nBob,87",
  columns: [
    { name: "name", type: "string", sample: ["Alice", "Bob"], nullCount: 0, uniqueCount: 2 },
    { name: "score", type: "number", sample: [95, 87], nullCount: 0, uniqueCount: 2 },
  ],
  rows: [
    { name: "Alice", score: 95 },
    { name: "Bob", score: 87 },
  ],
  rowCount: 2,
};

describe("OpenRouter API", () => {
  jest.setTimeout(15000);
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";

  beforeAll(() => {
    if (!apiKey) {
      console.warn("OPENROUTER_API_KEY not set, skipping API tests");
    }
  });

  it("can list models", async () => {
    if (!apiKey) return;

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // 403 means key is blocked at account level, not a code issue
    if (res.status === 403) {
      console.warn("API key blocked (403). Check account at openrouter.ai/keys");
      return;
    }

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("can call model with simple message", async () => {
    if (!apiKey) return;

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say hi" }],
        max_tokens: 10,
      }),
    });

    if (res.status === 403) {
      console.warn("API key blocked (403). Check account at openrouter.ai/keys");
      return;
    }

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.choices).toBeDefined();
    expect(data.choices[0].message.content).toBeDefined();
  });

  it("can call model with tools", async () => {
    if (!apiKey) return;

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "test_tool",
          description: "A test tool",
          parameters: {
            type: "object",
            properties: {
              value: { type: "string" },
            },
            required: ["value"],
          },
        },
      },
    ];

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: "Use the test_tool with value 'hello'",
          },
        ],
        tools,
        max_tokens: 100,
      }),
    });

    if (res.status === 403) {
      console.warn("API key blocked (403). Check account at openrouter.ai/keys");
      return;
    }

    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.choices[0].message.tool_calls).toBeDefined();
  });
});
