import { parseUploadedFile } from "@/lib/parse-data";

describe("parseUploadedFile", () => {
  it("parses CSV correctly", () => {
    const csv = "name,age,city\nAlice,30,NYC\nBob,25,LA";
    const buffer = Buffer.from(csv, "utf-8");
    const result = parseUploadedFile("test.csv", buffer);

    expect(result.fileName).toBe("test.csv");
    expect(result.rowCount).toBe(2);
    expect(result.columns).toHaveLength(3);
    expect(result.columns.map((c) => c.name)).toEqual(["name", "age", "city"]);
    expect(result.rows[0]).toEqual({ name: "Alice", age: 30, city: "NYC" });
    expect(result.rows[1]).toEqual({ name: "Bob", age: 25, city: "LA" });
  });

  it("detects column types", () => {
    const csv = "id,name,score,active\n1,alice,99.5,true\n2,bob,88.3,false";
    const buffer = Buffer.from(csv, "utf-8");
    const result = parseUploadedFile("types.csv", buffer);

    const idCol = result.columns.find((c) => c.name === "id");
    const nameCol = result.columns.find((c) => c.name === "name");
    const scoreCol = result.columns.find((c) => c.name === "score");
    const activeCol = result.columns.find((c) => c.name === "active");

    expect(idCol?.type).toBe("number");
    expect(nameCol?.type).toBe("string");
    expect(scoreCol?.type).toBe("number");
    expect(activeCol?.type).toBe("boolean");
  });

  it("handles empty rows", () => {
    const csv = "a,b\n1,2\n,\n3,4";
    const buffer = Buffer.from(csv, "utf-8");
    const result = parseUploadedFile("empty.csv", buffer);

    expect(result.rowCount).toBe(3);
    const bCol = result.columns.find((c) => c.name === "b");
    expect(bCol?.nullCount).toBeGreaterThanOrEqual(1);
  });

  it("throws on empty file", () => {
    const csv = "a,b\n";
    const buffer = Buffer.from(csv, "utf-8");
    expect(() => parseUploadedFile("empty.csv", buffer)).toThrow("File is empty");
  });

  it("throws on unsupported file type", () => {
    const buffer = Buffer.from("test");
    expect(() => parseUploadedFile("test.pdf", buffer)).toThrow("Unsupported file type");
  });

  it("counts unique values", () => {
    const csv = "color\nred\nblue\nred\ngreen\nblue";
    const buffer = Buffer.from(csv, "utf-8");
    const result = parseUploadedFile("colors.csv", buffer);

    const colorCol = result.columns.find((c) => c.name === "color");
    expect(colorCol?.uniqueCount).toBe(3);
  });

  it("provides sample values", () => {
    const csv = "val\na\nb\nc\nd\ne\nf";
    const buffer = Buffer.from(csv, "utf-8");
    const result = parseUploadedFile("sample.csv", buffer);

    const valCol = result.columns.find((c) => c.name === "val");
    expect(valCol?.sample).toEqual(["a", "b", "c", "d", "e"]);
  });
});
