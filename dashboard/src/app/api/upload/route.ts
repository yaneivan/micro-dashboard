import { parseUploadedFile } from "@/lib/parse-data";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const ctx = "upload";
  try {
    logger.info(ctx, "Upload request received");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      logger.warn(ctx, "No file provided");
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    logger.info(ctx, `File: ${file.name}, type: ${file.type}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    const validExtensions = [".csv", ".xls", ".xlsx"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();

    if (!validExtensions.includes(ext)) {
      logger.warn(ctx, `Unsupported file extension: ${ext}`);
      return Response.json(
        { error: "Unsupported file type. Upload CSV or Excel files." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const maxSize = 50 * 1024 * 1024;
    if (buffer.length > maxSize) {
      logger.warn(ctx, `File too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
      return Response.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    logger.info(ctx, "Parsing file...");
    const dataSet = parseUploadedFile(file.name, buffer);
    logger.info(ctx, `Parsed: ${dataSet.rowCount} rows, ${dataSet.columns.length} columns`);
    logger.debug(ctx, "Columns", dataSet.columns.map((c) => `${c.name} (${c.type})`));

    return Response.json({
      sessionId: dataSet.sessionId,
      fileName: dataSet.fileName,
      columns: dataSet.columns,
      rowCount: dataSet.rowCount,
      preview: dataSet.rows.slice(0, 5),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(ctx, `Upload failed: ${message}`, error);
    return Response.json({ error: message }, { status: 500 });
  }
}
