"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bot,
  User,
  Loader2,
  Paperclip,
  BarChart3,
  Moon,
  Sun,
  Trash2,
  X,
  FileSpreadsheet,
  Brain,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { ChartSpec } from "@/types";
import { ModelSelector, type ModelId, MODELS } from "@/components/model-selector";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  charts?: ChartSpec[];
  reasoning?: string[];
  fileName?: string;
  model?: string;
  parentId?: string;
  timestamp: number;
}

interface PendingFile {
  file: File;
  preview: string;
}

const DARK_LAYOUT: Record<string, unknown> = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "#e5e7eb", family: "Inter, system-ui, sans-serif" },
  xaxis: {
    gridcolor: "rgba(255,255,255,0.06)",
    zerolinecolor: "rgba(255,255,255,0.1)",
  },
  yaxis: {
    gridcolor: "rgba(255,255,255,0.06)",
    zerolinecolor: "rgba(255,255,255,0.1)",
  },
};

const LIGHT_LAYOUT: Record<string, unknown> = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "#374151", family: "Inter, system-ui, sans-serif" },
  xaxis: {
    gridcolor: "rgba(0,0,0,0.05)",
    zerolinecolor: "rgba(0,0,0,0.08)",
  },
  yaxis: {
    gridcolor: "rgba(0,0,0,0.05)",
    zerolinecolor: "rgba(0,0,0,0.08)",
  },
};

const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#818cf8",
  "#60a5fa",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f87171",
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dark, setDark] = useState(false);
  const [model, setModel] = useState<ModelId>("openai/gpt-4.1-mini");
  const [sessionId, _setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const dataSetRef = useRef<Record<string, unknown> | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setSessionId = useCallback((id: string | null) => {
    sessionIdRef.current = id;
    _setSessionId(id);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }, []);

  const addFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xls", "xlsx"].includes(ext || "")) return;
    setPendingFile({ file, preview: file.name });
  }, []);

  const removeFile = useCallback(() => {
    setPendingFile(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) addFile(file);
    },
    [addFile]
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingFile) || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text || (pendingFile ? `Analyze ${pendingFile.file.name}` : ""),
      fileName: pendingFile?.file.name,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      let currentSessionId = sessionIdRef.current;

      if (pendingFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", pendingFile.file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || "Upload failed");
        }
        const uploadData = await uploadRes.json();
        currentSessionId = uploadData.sessionId;
        setSessionId(currentSessionId);
        setPendingFile(null);
        setUploading(false);

        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, model }),
        });
        const analysis = await analyzeRes.json();
        if (!analyzeRes.ok) throw new Error(analysis.error || "Analysis failed");

        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: analysis.insight || analysis.summary || "Analysis complete.",
          charts: analysis.charts || [],
          reasoning: analysis.reasoning || [],
          model,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            question: text,
            model,
            history: messages.slice(-6).map((m) => ({
              role: m.role,
              content: m.content,
              ...(m.role === "assistant" && "charts" in m && (m as { charts?: unknown[] }).charts?.length
                ? {
                    charts: (m as { charts: { title: string; type: string }[] }).charts.map((c) => ({
                      title: c.title,
                      type: c.type,
                    })),
                  }
                : {}),
            })),
          }),
        });
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: data.error ? `Error: ${data.error}` : data.answer,
          charts: data.charts || [],
          reasoning: data.reasoning || [],
          model,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: `Error: ${msg}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setUploading(false);
    }
  }, [input, isLoading, messages, pendingFile]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const regenerateMessage = useCallback(async (msgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    const assistantMsg = messages[msgIndex];
    const userMsgIndex = messages.slice(0, msgIndex).findLastIndex((m) => m.role === "user");
    if (userMsgIndex === -1) return;

    const userMsg = messages[userMsgIndex];
    const newMessages = messages.slice(0, msgIndex);
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          question: userMsg.content,
          model,
          history: newMessages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      const newAssistantMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.error ? `Error: ${data.error}` : data.answer,
        charts: data.charts || [],
        reasoning: data.reasoning || [],
        model,
        parentId: assistantMsg.id,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newAssistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: "Sorry, something went wrong.",
          model,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, sessionId, model]);

  const startEditing = useCallback((msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    setEditingId(msgId);
    setEditText(msg.content);
  }, [messages]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, []);

  const submitEdit = useCallback(async () => {
    if (!editingId || !editText.trim()) return;

    const msgIndex = messages.findIndex((m) => m.id === editingId);
    if (msgIndex === -1) return;

    const newMessages = messages.slice(0, msgIndex);
    const editedMsg: ChatMessage = {
      ...messages[msgIndex],
      content: editText.trim(),
    };
    newMessages.push(editedMsg);
    setMessages(newMessages);
    setEditingId(null);
    setEditText("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          question: editText.trim(),
          model,
          history: newMessages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.error ? `Error: ${data.error}` : data.answer,
        charts: data.charts || [],
        reasoning: data.reasoning || [],
        model,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: "Sorry, something went wrong.",
          model,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [editingId, editText, messages, sessionId, model]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setPendingFile(null);
  }, []);

  const canSend = Boolean((input.trim() || pendingFile) && !isLoading);

  return (
    <div
      className="flex flex-col h-screen bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
          >
            <Card className="p-12 border-2 border-dashed border-primary/50 bg-primary/5">
              <div className="flex flex-col items-center gap-4">
                <FileSpreadsheet className="w-12 h-12 text-primary" />
                <p className="text-lg font-medium">Drop your CSV or Excel file</p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between px-4 h-14 border-b glass">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg tracking-tight">DataLens</span>
          {sessionId && (
            <Badge variant="secondary" className="text-xs">
              Data loaded
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ModelSelector value={model} onChange={setModel} />
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={clearChat} className="h-8 w-8">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] gap-6"
            >
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">AI Data Dashboard</h1>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  Upload a file or ask a question about your data.
                </p>
              </div>
            </motion.div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              dark={dark}
              isEditing={editingId === msg.id}
              editText={editText}
              onEditChange={setEditText}
              onRegenerate={() => regenerateMessage(msg.id)}
              onStartEdit={() => startEditing(msg.id)}
              onCancelEdit={cancelEditing}
              onSubmitEdit={submitEdit}
            />
          ))}

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <Card className="p-4">
                <div className="flex gap-1 items-center text-muted-foreground">
                  <span className="text-xs">{uploading ? "Uploading & analyzing..." : "Thinking"}</span>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 rounded-full bg-current"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t glass">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <AnimatePresence>
            {pendingFile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-2"
              >
                <Badge variant="secondary" className="gap-1 pr-1">
                  <FileSpreadsheet className="w-3 h-3" />
                  {pendingFile.preview}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1 hover:bg-destructive/20"
                    onClick={removeFile}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 items-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 flex-shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={sessionId ? "Ask about your data..." : "Upload a file or ask a question..."}
              className="min-h-[44px] max-h-32 resize-none flex-1"
              rows={1}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!canSend}
              suppressHydrationWarning
              className="h-10 w-10 flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) addFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function MessageBubble({
  msg,
  dark,
  isEditing,
  editText,
  onEditChange,
  onRegenerate,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
}: {
  msg: ChatMessage;
  dark: boolean;
  isEditing: boolean;
  editText: string;
  onEditChange: (text: string) => void;
  onRegenerate: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: () => void;
}) {
  const isUser = msg.role === "user";
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const modelLabel = msg.model
    ? MODELS.find((m) => m.id === msg.model)?.label || msg.model
    : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      onSubmitEdit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-primary" />
          </div>
        )}

        <div className={`max-w-[85%] space-y-2 ${isUser ? "order-1" : ""}`}>
          {(msg.content || isUser) && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                isUser ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {msg.fileName && isUser && (
                <Badge variant="secondary" className="mb-2 text-xs gap-1">
                  <FileSpreadsheet className="w-3 h-3" />
                  {msg.fileName}
                </Badge>
              )}
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => onEditChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[80px] text-sm"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={onSubmitEdit} className="h-7 text-xs">
                      Send
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 text-xs">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-current">
                  <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                </div>
              )}
            </div>
          )}

          {msg.reasoning && msg.reasoning.length > 0 && (
            <div className="rounded-lg border bg-muted/50 overflow-hidden">
              <button
                onClick={() => setReasoningOpen(!reasoningOpen)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Reasoning ({msg.reasoning.length} steps)</span>
                {reasoningOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                )}
              </button>
              <AnimatePresence>
                {reasoningOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2">
                      {msg.reasoning.map((step, i) => (
                        <div key={i} className="text-xs text-muted-foreground/80 border-l-2 border-primary/20 pl-2">
                          <span className="font-medium text-primary/60">Step {i + 1}</span>
                          <p className="whitespace-pre-wrap mt-0.5">{step}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {isUser && (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </div>

      {msg.charts && msg.charts.length > 0 && (
        <div className="space-y-3 ml-11">
          {msg.charts.map((chart, i) => (
            <ChartCard key={i} chart={chart} index={i} dark={dark} />
          ))}
        </div>
      )}

      <div className={`flex items-center gap-2 ${isUser ? "justify-end mr-11" : "ml-11"}`}>
        {!isUser && !isEditing && (
          <>
            {modelLabel && (
              <span className="text-[10px] text-muted-foreground/50">{modelLabel}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              className="h-6 px-2 gap-1 text-muted-foreground/50 hover:text-muted-foreground"
            >
              <Loader2 className="w-3 h-3" />
              <span className="text-[10px]">Regenerate</span>
            </Button>
          </>
        )}
        {isUser && !isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStartEdit}
            className="h-6 px-2 gap-1 text-muted-foreground/50 hover:text-muted-foreground"
          >
            <Pencil className="w-3 h-3" />
            <span className="text-[10px]">Edit</span>
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function ChartCard({ chart, index, dark }: { chart: ChartSpec; index: number; dark: boolean }) {
  const baseLayout = dark ? DARK_LAYOUT : LIGHT_LAYOUT;

  const layout = {
    ...baseLayout,
    ...chart.layout,
    title: {
      text: chart.title || "",
      font: { size: 14, color: dark ? "#e5e7eb" : "#111827", family: "Inter, system-ui, sans-serif" },
      x: 0.02,
      xanchor: "left" as const,
    },
    height: 350,
    margin: { l: 50, r: 20, t: 50, b: 50 },
    colorway: CHART_COLORS,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className="overflow-hidden border bg-card">
        <div className="w-full" style={{ minHeight: 350 }}>
          <Plot
            data={chart.data}
            layout={layout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "350px" }}
            useResizeHandler
          />
        </div>
      </Card>
    </motion.div>
  );
}
