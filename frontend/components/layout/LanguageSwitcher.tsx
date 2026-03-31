"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANGUAGES } from "@/lib/i18n";
import { useLanguageStore } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function LanguageSwitcher() {
  const { lang, setLanguage } = useLanguageStore();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-stone-500 hover:text-stone-700 border border-stone-200 rounded-sm hover:border-stone-300 transition-all"
      >
        <span className="text-sm">{current.flag}</span>
        <span className="font-medium uppercase">{current.code}</span>
        <span className="text-stone-300">{current.symbol}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-sm shadow-lg overflow-hidden min-w-[160px]"
            >
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLanguage(l.code);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left",
                    l.code === lang
                      ? "bg-amber-50 text-amber-800"
                      : "text-stone-700 hover:bg-stone-50",
                  )}
                >
                  <span className="text-base">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  <span className="text-stone-400 text-xs font-mono">{l.symbol}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
