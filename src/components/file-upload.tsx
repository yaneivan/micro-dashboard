"use client";

import { useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, AlertCircle, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  onUploadComplete: (data: {
    sessionId: string;
    fileName: string;
    columns: { name: string; type: string; sample: unknown[]; nullCount: number; uniqueCount: number }[];
    rowCount: number;
    preview: Record<string, unknown>[];
  }) => void;
  onError: (message: string) => void;
}

export function FileUpload({ onUploadComplete, onError }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState<{ name: string; rows: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);
      setUploaded(null);

      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 200);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(interval);

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }

        const data = await res.json();
        setProgress(100);
        setUploaded({ name: data.fileName, rows: data.rowCount });

        setTimeout(() => {
          onUploadComplete(data);
        }, 500);
      } catch (error) {
        clearInterval(interval);
        const msg = error instanceof Error ? error.message : "Upload failed";
        onError(msg);
      } finally {
        setUploading(false);
      }
    },
    [onUploadComplete, onError]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-2xl mx-auto"
    >
      <Card
        className={`
          relative overflow-hidden cursor-pointer
          border-2 border-dashed transition-all duration-300 glass
          ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : uploaded
              ? "border-emerald-500 bg-emerald-500/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          }
        `}
        onClick={!uploading && !uploaded ? onClick : undefined}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className="flex flex-col items-center justify-center p-12 gap-4">
          <AnimatePresence mode="wait">
            {uploaded ? (
              <motion.div
                key="success"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-lg">{uploaded.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {uploaded.rows.toLocaleString()} rows loaded
                  </p>
                </div>
              </motion.div>
            ) : uploading ? (
              <motion.div
                key="uploading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-xs flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <FileSpreadsheet className="w-8 h-8 text-primary" />
                </div>
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">Processing data...</p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <motion.div
                  animate={isDragging ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                  className="w-16 h-16 rounded-full bg-muted flex items-center justify-center"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </motion.div>
                <div className="text-center">
                  <p className="font-medium text-lg">
                    {isDragging ? "Drop your file here" : "Drop a file or click to upload"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    CSV or Excel files up to 50MB
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-primary/5 pointer-events-none"
          />
        )}
      </Card>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        onChange={onFileChange}
      />
    </motion.div>
  );
}
