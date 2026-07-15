"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Code2,
  Table2,
  Download,
  Loader2,
  BarChart3,
  MessageSquare,
  Moon,
  Sun,
} from "lucide-react";
import { FileUpload } from "./file-upload";
import { AIInsight } from "./ai-insight";
import { ChartViewer } from "./chart-viewer";
import { DataChat } from "./data-chat";
import { AnalyzingSkeleton } from "./loading-states";
import type { ChartSpec, AgentState, ColumnInfo } from "@/types";

interface UploadData {
  sessionId: string;
  fileName: string;
  columns: ColumnInfo[];
  rowCount: number;
  preview: Record<string, unknown>[];
}

interface AnalysisData {
  insight: string;
  charts: ChartSpec[];
  code: string;
  summary: string;
}

export function Dashboard() {
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [uploadData, setUploadData] = useState<UploadData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [dark, setDark] = useState(false);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }, []);

  const handleUploadComplete = useCallback(async (data: UploadData) => {
    setUploadData(data);
    setAgentState("analyzing");
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: data.sessionId }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Analysis failed");
      }

      setAnalysis(result);
      setAgentState("rendering");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setError(msg);
      setAgentState("error");
    }
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    setAgentState("error");
  }, []);

  const reset = useCallback(() => {
    setAgentState("idle");
    setUploadData(null);
    setAnalysis(null);
    setError(null);
    setShowCode(false);
    setShowChat(false);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b glass">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {agentState !== "idle" && (
              <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="font-bold text-lg tracking-tight">DataLens</span>
            </div>
          </div>

          {uploadData && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {uploadData.fileName}
              </Badge>
              <Badge variant="outline">
                {uploadData.rowCount.toLocaleString()} rows
              </Badge>
              {analysis && (
                <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                  {analysis.charts.length} charts
                </Badge>
              )}
            </div>
          )}

          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <AnimatePresence mode="wait">
          {agentState === "idle" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh] gap-6"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center space-y-2 mb-4"
              >
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  AI Data Dashboard
                </h1>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  Upload your data and let AI explore, analyze, and visualize it for you.
                </p>
              </motion.div>
              <FileUpload
                onUploadComplete={handleUploadComplete}
                onError={handleError}
              />
            </motion.div>
          )}

          {(agentState === "analyzing" || agentState === "planning") && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div>
                  <h2 className="font-semibold">Analyzing your data</h2>
                  <p className="text-sm text-muted-foreground">
                    AI is exploring patterns, distributions, and insights...
                  </p>
                </div>
              </div>
              <AnalyzingSkeleton />
            </motion.div>
          )}

          {agentState === "rendering" && analysis && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <AIInsight insight={analysis.insight} isVisible={true} />

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={showCode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowCode(!showCode)}
                >
                  <Code2 className="w-4 h-4 mr-1.5" />
                  {showCode ? "Hide" : "Show"} Code
                </Button>
                <Button
                  variant={showChat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                  {showChat ? "Hide" : "Ask"} Chat
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const blob = new Blob([analysis.code], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "analysis.py";
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="w-4 h-4 mr-1.5" />
                  Download Code
                </Button>
              </div>

              <AnimatePresence>
                {showCode && analysis.code && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Card className="overflow-hidden border-0 bg-[#1e1e2e] text-[#cdd6f4]">
                      <div className="p-4 border-b border-white/10 flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-[#f38ba8]" />
                          <div className="w-3 h-3 rounded-full bg-[#f9e2af]" />
                          <div className="w-3 h-3 rounded-full bg-[#a6e3a1]" />
                        </div>
                        <span className="text-xs text-white/50 ml-2">analysis.py</span>
                      </div>
                      <ScrollArea className="max-h-96">
                        <pre className="p-4 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                          <code>{analysis.code}</code>
                        </pre>
                      </ScrollArea>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <ChartViewer charts={analysis.charts} isVisible={true} />

              <DataChat sessionId={uploadData!.sessionId} isVisible={showChat} />

              {analysis.summary && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Separator className="my-8" />
                  <Card className="p-6 border-0 bg-muted/30">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Table2 className="w-4 h-4" />
                      Full Analysis Summary
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {analysis.summary}
                    </p>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}

          {agentState === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
            >
              <Card className="p-8 max-w-md w-full text-center space-y-4 border-destructive/20">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl">!</span>
                </div>
                <h2 className="font-semibold text-lg">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button onClick={reset} variant="outline">
                  Try Again
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
