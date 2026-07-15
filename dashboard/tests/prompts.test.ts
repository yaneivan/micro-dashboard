import { buildSystemPrompt, buildChatPrompt } from "@/lib/prompts";
import type { DataSet } from "@/types";

const mockDataset: DataSet = {
  sessionId: "test",
  fileName: "sales.csv",
  rawCsv: "date,revenue,region\n2024-01-01,1000,North\n2024-01-02,1500,South",
  columns: [
    { name: "date", type: "date", sample: ["2024-01-01"], nullCount: 0, uniqueCount: 2 },
    { name: "revenue", type: "number", sample: [1000, 1500], nullCount: 0, uniqueCount: 2 },
    { name: "region", type: "string", sample: ["North", "South"], nullCount: 0, uniqueCount: 2 },
  ],
  rows: [
    { date: "2024-01-01", revenue: 1000, region: "North" },
    { date: "2024-01-02", revenue: 1500, region: "South" },
  ],
  rowCount: 2,
};

describe("prompts", () => {
  it("builds system prompt with dataset info", () => {
    const prompt = buildSystemPrompt(mockDataset);

    expect(prompt).toContain("sales.csv");
    expect(prompt).toContain("2");
    expect(prompt).toContain("date");
    expect(prompt).toContain("revenue");
    expect(prompt).toContain("region");
    expect(prompt).toContain("North");
  });

  it("system prompt includes chart instructions", () => {
    const prompt = buildSystemPrompt(mockDataset);

    expect(prompt).toContain("bar");
    expect(prompt).toContain("line");
    expect(prompt).toContain("pie");
    expect(prompt).toContain("scatter");
  });

  it("builds chat prompt with question", () => {
    const prompt = buildChatPrompt(mockDataset, "What is the total revenue?");

    expect(prompt).toContain("What is the total revenue?");
    expect(prompt).toContain("sales.csv");
    expect(prompt).toContain("revenue");
  });

  it("chat prompt includes data sample", () => {
    const prompt = buildChatPrompt(mockDataset, "test");

    expect(prompt).toContain("1000");
    expect(prompt).toContain("North");
  });
});
