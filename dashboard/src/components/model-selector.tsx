"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Cpu, Check } from "lucide-react";

export const MODELS = [
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "OpenAI" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini", provider: "OpenAI" },
  { id: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "OpenAI" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "OpenAI" },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "DeepSeek" },
  { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "DeepSeek" },
  { id: "xiaomi/mimo-v2.5", label: "MiMo V2.5", provider: "Xiaomi" },
  { id: "minimax/minimax-m3", label: "MiniMax M3", provider: "MiniMax" },
  { id: "z-ai/glm-5.2", label: "GLM-5.2", provider: "Zhipu AI" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra", provider: "NVIDIA" },
  { id: "tencent/hy3:free", label: "HY3", provider: "Tencent" },
  { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5", provider: "Moonshot" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

interface ModelSelectorProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MODELS.find((m) => m.id === value) || MODELS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 h-8 text-xs"
        onClick={() => setOpen(!open)}
      >
        <Cpu className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">{current.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border bg-popover p-1 shadow-md max-h-80 overflow-y-auto">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md hover:bg-accent hover:text-accent-foreground text-left"
            >
              <span className="font-medium flex-1">{model.label}</span>
              <span className="text-muted-foreground">{model.provider}</span>
              {model.id === value && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
