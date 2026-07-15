"use client";

import { motion } from "framer-motion";

export function AnalyzingSkeleton() {
  return (
    <div className="space-y-6">
      <InsightSkeleton />
      <ChartsSkeleton />
    </div>
  );
}

function InsightSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border bg-card p-6 md:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-xl border bg-card p-4"
        >
          <div className="h-4 w-32 bg-muted rounded animate-pulse mb-4" />
          <div className="h-56 bg-muted/50 rounded animate-pulse" />
        </motion.div>
      ))}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center text-muted-foreground">
      <span className="text-xs">Thinking</span>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}
