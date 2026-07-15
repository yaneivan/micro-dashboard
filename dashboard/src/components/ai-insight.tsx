"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Sparkles, Lightbulb } from "lucide-react";

interface AIInsightProps {
  insight: string;
  isVisible: boolean;
}

export function AIInsight({ insight, isVisible }: AIInsightProps) {
  if (!isVisible || !insight) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"
            >
              <Sparkles className="w-5 h-5 text-primary" />
            </motion.div>

            <div className="flex-1 min-w-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 mb-2"
              >
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  Key Insight
                </span>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-base md:text-lg leading-relaxed text-foreground/90"
              >
                {insight}
              </motion.p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      </Card>
    </motion.div>
  );
}
