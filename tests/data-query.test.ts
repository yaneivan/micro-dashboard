import { executeQuery, type QueryOperation } from "@/lib/data-query";

const testRows: Record<string, unknown>[] = [
  { city: "NYC", category: "A", amount: 100, price: 10 },
  { city: "NYC", category: "B", amount: 200, price: 20 },
  { city: "LA", category: "A", amount: 150, price: 15 },
  { city: "LA", category: "A", amount: 300, price: 30 },
  { city: "Chicago", category: "B", amount: 50, price: 5 },
  { city: "Chicago", category: "B", amount: 250, price: 25 },
  { city: "NYC", category: "A", amount: null, price: null },
];

describe("data-query", () => {
  describe("groupby", () => {
    it("groups by column and computes mean", () => {
      const result = executeQuery(testRows, {
        op: "groupby",
        groupBy: "city",
        aggColumn: "amount",
        aggFunc: "mean",
      }) as Record<string, unknown>;
      expect(result.operation).toBe("groupby");
      const r = result.result as Array<Record<string, unknown>>;
      expect(r.length).toBe(3);
      // NYC: (100+200)/2 = 150 (null excluded)
      const nyc = r.find((x) => x.city === "NYC");
      expect(nyc?.mean).toBe(150);
    });

    it("groups by column and computes sum", () => {
      const result = executeQuery(testRows, {
        op: "groupby",
        groupBy: "category",
        aggColumn: "amount",
        aggFunc: "sum",
      }) as Record<string, unknown>;
      const r = result.result as Array<Record<string, unknown>>;
      const catA = r.find((x) => x.category === "A");
      expect(catA?.sum).toBe(550); // 100+150+300
    });

    it("limits results", () => {
      const result = executeQuery(testRows, {
        op: "groupby",
        groupBy: "city",
        aggColumn: "amount",
        aggFunc: "count",
        limit: 2,
      }) as Record<string, unknown>;
      const r = result.result as Array<Record<string, unknown>>;
      expect(r.length).toBe(2);
    });
  });

  describe("value_counts", () => {
    it("counts values", () => {
      const result = executeQuery(testRows, {
        op: "value_counts",
        column: "city",
      }) as Record<string, unknown>;
      expect(result.total).toBe(7);
      const r = result.result as Array<Record<string, unknown>>;
      expect(r[0].value).toBe("NYC");
      expect(r[0].count).toBe(3);
    });

    it("limits results", () => {
      const result = executeQuery(testRows, {
        op: "value_counts",
        column: "city",
        limit: 2,
      }) as Record<string, unknown>;
      const r = result.result as Array<Record<string, unknown>>;
      expect(r.length).toBe(2);
    });
  });

  describe("filter_stats", () => {
    it("filters and returns matched count", () => {
      const result = executeQuery(testRows, {
        op: "filter_stats",
        column: "city",
        operator: "eq",
        value: "NYC",
      }) as Record<string, unknown>;
      expect(result.matched).toBe(3);
      expect(result.total).toBe(7);
    });

    it("computes stats on filtered subset", () => {
      const result = executeQuery(testRows, {
        op: "filter_stats",
        column: "city",
        operator: "eq",
        value: "NYC",
        statsColumn: "amount",
      }) as Record<string, unknown>;
      expect(result.stats).toBeDefined();
      const stats = result.stats as Record<string, unknown>;
      expect(stats.mean).toBe(150); // (100+200)/2, null excluded
    });

    it("handles gt filter", () => {
      const result = executeQuery(testRows, {
        op: "filter_stats",
        column: "amount",
        operator: "gt",
        value: 200,
      }) as Record<string, unknown>;
      expect(result.matched).toBe(2); // 300, 250
    });

    it("handles contains filter", () => {
      const result = executeQuery(testRows, {
        op: "filter_stats",
        column: "city",
        operator: "contains",
        value: "chic",
      }) as Record<string, unknown>;
      expect(result.matched).toBe(2);
    });
  });

  describe("correlation", () => {
    it("computes Pearson correlation", () => {
      const result = executeQuery(testRows, {
        op: "correlation",
        columns: ["amount", "price"],
      }) as Record<string, unknown>;
      expect(result.pearson_r).toBeDefined();
      expect(typeof result.pearson_r).toBe("number");
      // amount and price should be strongly correlated in test data
      expect(Math.abs(result.pearson_r as number)).toBeGreaterThan(0.9);
      expect(result.strength).toBe("strong");
    });

    it("returns error for too few pairs", () => {
      const result = executeQuery(
        [{ a: 1, b: null }],
        { op: "correlation", columns: ["a", "b"] }
      ) as Record<string, unknown>;
      expect(result.error).toBeDefined();
    });
  });

  describe("describe", () => {
    it("returns stats and distribution", () => {
      const result = executeQuery(testRows, {
        op: "describe",
        column: "amount",
      }) as Record<string, unknown>;
      expect(result.stats).toBeDefined();
      expect(result.distribution).toBeDefined();
      const stats = result.stats as Record<string, unknown>;
      expect(stats.count).toBe(6); // null excluded
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(300);
    });

    it("returns error for non-numeric column", () => {
      const result = executeQuery(testRows, {
        op: "describe",
        column: "city",
      }) as Record<string, unknown>;
      expect(result.error).toBeDefined();
    });
  });

  describe("top_combos", () => {
    it("finds most common category pairs", () => {
      const result = executeQuery(testRows, {
        op: "top_combos",
        col1: "city",
        col2: "category",
      }) as Record<string, unknown>;
      const r = result.result as Array<Record<string, unknown>>;
      expect(r.length).toBeGreaterThan(0);
      // NYC+A should be top combo (2 occurrences)
      expect(r[0].city).toBe("NYC");
      expect(r[0].category).toBe("A");
      expect(r[0].count).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles unknown operation", () => {
      const result = executeQuery(testRows, {
        op: "unknown" as QueryOperation["op"],
      } as QueryOperation);
      expect(result.error).toBeDefined();
    });

    it("handles empty dataset", () => {
      const result = executeQuery([], {
        op: "groupby",
        groupBy: "city",
        aggColumn: "amount",
        aggFunc: "mean",
      }) as Record<string, unknown>;
      const r = result.result as Array<Record<string, unknown>>;
      expect(r.length).toBe(0);
    });
  });
});
