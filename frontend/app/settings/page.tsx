"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  Bell, Mail, Send, Save, Plus, X,
  Shield, Sliders, Palette,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { prefsApi, type Preferences } from "@/lib/api";
import { cn } from "@/lib/utils";

const AUCTION_SOURCES = [
  { value: "drouot", label: "Drouot" },
  { value: "interencheres", label: "Interenchères" },
  { value: "invaluable", label: "Invaluable" },
  { value: "christies", label: "Christie's" },
  { value: "sothebys", label: "Sotheby's" },
];

const CATEGORIES = [
  "Paintings", "Prints", "Sculptures", "Drawings",
  "Photography", "Jewelry", "Furniture", "Asian Art",
  "Books & Manuscripts", "Silverware",
];

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card-luxury p-6">
      <div className="flex items-start gap-3 mb-6 pb-5 border-b border-white/[0.04]">
        <div className="w-8 h-8 rounded-sm bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-gold">{icon}</span>
        </div>
        <div>
          <div className="text-sm font-medium text-ivory">{title}</div>
          {subtitle && <div className="text-xs text-ivory/35 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm text-ivory/80">{label}</div>
        {description && <div className="text-xs text-ivory/35 mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-10 h-5 rounded-full border transition-all duration-200 flex-shrink-0",
          checked
            ? "bg-gold/80 border-gold"
            : "bg-white/[0.06] border-white/10"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200",
            checked ? "left-5 bg-obsidian" : "left-0.5 bg-ivory/30"
          )}
        />
      </button>
    </div>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInput("");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-sm bg-gold/10 border border-gold/20 text-xs text-gold"
          >
            {tag}
            <button
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-gold/50 hover:text-gold transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="input-luxury flex-1 text-xs"
        />
        <button onClick={add} className="btn-ghost text-xs py-2 px-3">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function CheckboxGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-sm text-xs font-medium border transition-all duration-150",
              active
                ? "bg-gold/10 border-gold/30 text-gold"
                : "bg-white/[0.03] border-white/10 text-ivory/50 hover:border-white/20 hover:text-ivory/70"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const { data: savedPrefs, isLoading, mutate } = useSWR(
    "preferences",
    () => prefsApi.get().then((r) => r.data)
  );

  const [prefs, setPrefs] = useState<Partial<Preferences>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (savedPrefs) setPrefs(savedPrefs);
  }, [savedPrefs]);

  const update = (partial: Partial<Preferences>) => {
    setPrefs((prev) => ({ ...prev, ...partial }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await prefsApi.update(prefs);
      await mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 ml-[52px] flex items-center justify-center">
          <div className="text-ivory/30">Loading preferences…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[52px]">
        <TopBar
          title="Settings"
          subtitle="Customize your deal intelligence"
          actions={
            <button
              onClick={save}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-medium border transition-all",
                saved
                  ? "bg-deal/10 border-deal/30 text-deal"
                  : "btn-gold"
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
            </button>
          }
        />

        <main className="px-8 py-8 max-w-3xl space-y-6">

          {/* Alert preferences */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <Section
              title="Alerts"
              subtitle="When and how you receive deal notifications"
              icon={<Bell className="w-4 h-4" />}
            >
              <div className="space-y-1 divide-y divide-white/[0.04]">
                <Toggle
                  checked={prefs.is_alerts_enabled ?? true}
                  onChange={(v) => update({ is_alerts_enabled: v })}
                  label="Enable deal alerts"
                  description="Receive notifications when deals above your threshold are detected"
                />
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="label-caps mb-3">Alert channel</div>
                  <div className="flex gap-2">
                    {(["email", "telegram", "both"] as const).map((ch) => (
                      <button
                        key={ch}
                        onClick={() => update({ alert_channel: ch })}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-sm text-xs font-medium border transition-all",
                          prefs.alert_channel === ch
                            ? "bg-gold/10 border-gold/30 text-gold"
                            : "border-white/10 text-ivory/50 hover:border-white/20"
                        )}
                      >
                        {ch === "email" ? <Mail className="w-3.5 h-3.5" /> : ch === "telegram" ? <Send className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                        {ch === "both" ? "Email + Telegram" : ch.charAt(0).toUpperCase() + ch.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {(prefs.alert_channel === "email" || prefs.alert_channel === "both") && (
                  <div>
                    <label className="label-caps block mb-2">Alert email</label>
                    <input
                      value={prefs.alert_email || ""}
                      onChange={(e) => update({ alert_email: e.target.value })}
                      placeholder="you@email.com"
                      className="input-luxury"
                    />
                  </div>
                )}

                {(prefs.alert_channel === "telegram" || prefs.alert_channel === "both") && (
                  <div>
                    <label className="label-caps block mb-2">Telegram Chat ID</label>
                    <input
                      value={prefs.telegram_chat_id || ""}
                      onChange={(e) => update({ telegram_chat_id: e.target.value })}
                      placeholder="Your Telegram chat ID"
                      className="input-luxury font-mono"
                    />
                    <p className="text-2xs text-ivory/30 mt-1.5">
                      Message @userinfobot on Telegram to get your chat ID
                    </p>
                  </div>
                )}
              </div>
            </Section>
          </motion.div>

          {/* Score threshold */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Section
              title="Deal Threshold"
              subtitle="Minimum score to trigger an alert"
              icon={<Sliders className="w-4 h-4" />}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ivory/60">Minimum deal score</span>
                  <span className="font-mono text-xl text-gold font-semibold">
                    {prefs.min_deal_score ?? 75}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={prefs.min_deal_score ?? 75}
                  onChange={(e) => update({ min_deal_score: Number(e.target.value) })}
                  className="w-full accent-gold cursor-pointer"
                />
                <div className="flex justify-between text-2xs text-ivory/25 font-mono">
                  {[50, 60, 70, 75, 80, 85, 90, 95].map((v) => (
                    <span key={v}>{v}</span>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {[
                    { v: 70, label: "Broad", desc: "More alerts" },
                    { v: 75, label: "Balanced", desc: "Recommended" },
                    { v: 80, label: "Selective", desc: "High quality" },
                    { v: 85, label: "Hot only", desc: "Rare deals" },
                  ].map(({ v, label, desc }) => (
                    <button
                      key={v}
                      onClick={() => update({ min_deal_score: v })}
                      className={cn(
                        "flex-1 py-2 rounded-sm text-xs border transition-all text-center",
                        prefs.min_deal_score === v
                          ? "bg-gold/10 border-gold/30 text-gold"
                          : "border-white/10 text-ivory/40 hover:border-white/20"
                      )}
                    >
                      <div className="font-medium">{label}</div>
                      <div className="text-2xs opacity-60 mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="label-caps block mb-2">Budget maximum (EUR)</label>
                  <input
                    type="number"
                    value={prefs.budget_max || ""}
                    onChange={(e) => update({ budget_max: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="No limit"
                    className="input-luxury font-mono"
                    min={0}
                  />
                  <p className="text-2xs text-ivory/30 mt-1.5">
                    Only alert when current price is below this amount
                  </p>
                </div>
              </div>
            </Section>
          </motion.div>

          {/* Artists */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <Section
              title="Artist Watchlist"
              subtitle="Get priority alerts for specific artists"
              icon={<Palette className="w-4 h-4" />}
            >
              <TagInput
                value={prefs.favorite_artists || []}
                onChange={(v) => update({ favorite_artists: v })}
                placeholder="Add artist name (e.g. Bernard Buffet)"
              />
              <p className="text-2xs text-ivory/30 mt-3">
                When set, you'll only receive alerts for lots by these artists.
                Leave empty to monitor all artists.
              </p>
            </Section>
          </motion.div>

          {/* Categories + Sources */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <Section
              title="Filters"
              subtitle="Limit monitoring to specific categories and sources"
              icon={<Shield className="w-4 h-4" />}
            >
              <div className="space-y-5">
                <div>
                  <div className="label-caps mb-3">Categories (leave empty for all)</div>
                  <CheckboxGroup
                    options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                    value={prefs.categories || []}
                    onChange={(v) => update({ categories: v })}
                  />
                </div>
                <div className="divider-gold" />
                <div>
                  <div className="label-caps mb-3">Auction sources (leave empty for all)</div>
                  <CheckboxGroup
                    options={AUCTION_SOURCES}
                    value={prefs.auction_houses || []}
                    onChange={(v) => update({ auction_houses: v })}
                  />
                </div>
              </div>
            </Section>
          </motion.div>

          {/* Save button at bottom too */}
          <div className="flex justify-end pb-8">
            <button onClick={save} disabled={saving} className="btn-gold px-6">
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save All Changes"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
