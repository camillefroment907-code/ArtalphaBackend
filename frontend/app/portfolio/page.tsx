"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, TrendingUp, TrendingDown, Package, Trash2, Edit,
  BarChart2, X, Check, AlertCircle, Info,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { portfolioApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PriceDisplay } from "@/components/lots/PriceDisplay";
import { useLanguageStore } from "@/lib/useLanguage";
import { formatPriceInCurrency } from "@/lib/i18n";

interface ProjectionYear {
  year: number;
  conservative_eur: number;
  base_eur: number;
  optimistic_eur: number;
  base_roi_pct: number;
  cagr_pct: number;
  tier: string;
}

interface PortfolioItem {
  id: string;
  title: string;
  artist_name?: string;
  medium?: string;
  dimensions?: string;
  image_url?: string;
  purchase_price_eur: number;
  purchase_date?: string;
  purchase_source?: string;
  estimated_current_value_eur: number;
  gain_eur: number;
  gain_pct: number;
  is_for_sale: boolean;
  asking_price_eur?: number;
  notes?: string;
  artist_tier: string;
  base_cagr_pct: number;
  recommended_hold_years: number;
  sell_recommendation: string;
  projection_5y?: number;
  projection_10y?: number;
  projection_20y?: number;
  projections?: Record<number, ProjectionYear>;
}

interface PortfolioStats {
  total_invested_eur: number;
  total_current_eur: number;
  total_gain_eur: number;
  total_gain_pct: number;
  item_count: number;
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  blue_chip:   { label: "Blue Chip",   color: "text-amber-700 bg-amber-50 border-amber-200" },
  established: { label: "Établi",      color: "text-blue-700 bg-blue-50 border-blue-200" },
  emerging:    { label: "Émergent",    color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  unknown:     { label: "Décoratif",   color: "text-stone-600 bg-stone-50 border-stone-200" },
};

function StatBanner({ stats }: { stats: PortfolioStats }) {
  const { currency, locale } = useLanguageStore();
  const positive = stats.total_gain_pct >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[
        {
          label: "Investi total",
          value: formatPriceInCurrency(stats.total_invested_eur, currency, locale),
          sub: `${stats.item_count} œuvre${stats.item_count !== 1 ? "s" : ""}`,
          color: "text-stone-900",
        },
        {
          label: "Valeur actuelle est.",
          value: formatPriceInCurrency(stats.total_current_eur, currency, locale),
          sub: stats.total_gain_pct !== 0 ? "Estimation basée sur valeur estimée renseignée" : "Aucune estimation renseignée — valeur = prix d'achat",
          color: "text-stone-900",
        },
        {
          label: "Variation estimée",
          value: formatPriceInCurrency(stats.total_gain_eur, currency, locale),
          sub: "Écart entre valeur estimée et prix d'achat saisi",
          color: positive ? "text-emerald-600" : "text-red-600",
        },
        {
          label: "Variation de valeur",
          value: `${positive ? "+" : ""}${stats.total_gain_pct.toFixed(1)}%`,
          sub: "Hors frais acheteur et frais de vente",
          color: positive ? "text-emerald-600" : "text-red-600",
          icon: positive ? TrendingUp : TrendingDown,
        },
      ].map(({ label, value, sub, color, icon: Icon }) => (
        <div key={label} className="card-luxury p-5 space-y-1">
          <div className="text-2xs text-stone-400 tracking-wider uppercase font-semibold">{label}</div>
          <div className={cn("font-mono text-xl font-bold tabular-nums", color)}>
            {Icon ? (
              <span className="flex items-center gap-1.5">
                <Icon className="w-5 h-5" />
                {value}
              </span>
            ) : value}
          </div>
          <div className="text-xs text-stone-400">{sub}</div>
        </div>
      ))}
    </div>
  );
}

function ProjectionModal({
  item,
  onClose,
}: {
  item: PortfolioItem;
  onClose: () => void;
}) {
  const { currency, locale } = useLanguageStore();
  const years = item.projections ? Object.values(item.projections).sort((a, b) => a.year - b.year) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-sm border border-stone-200 shadow-xl w-full max-w-lg"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div>
            <div className="font-serif text-stone-900 font-medium">{item.title}</div>
            <div className="text-xs text-stone-400">{item.artist_name || "Artiste inconnu"}</div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Summary */}
          <div className="flex items-center gap-4 mb-6 p-3 bg-stone-50 rounded-sm border border-stone-100">
            <div className="text-center">
              <div className="text-xs text-stone-400 mb-0.5">Tier artiste</div>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", TIER_LABELS[item.artist_tier]?.color)}>
                {TIER_LABELS[item.artist_tier]?.label || item.artist_tier}
              </span>
            </div>
            <div className="text-center">
              <div className="text-xs text-stone-400 mb-0.5">CAGR base</div>
              <div className="font-mono text-sm font-bold text-stone-900">+{item.base_cagr_pct}%</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-xs text-stone-400 mb-0.5">Recommandation</div>
              <div className="text-xs text-stone-600">{item.sell_recommendation}</div>
            </div>
          </div>

          {/* Projection table */}
          {years.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left py-2 text-xs text-stone-400 font-medium">Horizon</th>
                    <th className="text-right py-2 text-xs text-stone-400 font-medium">Conservateur</th>
                    <th className="text-right py-2 text-xs text-emerald-600 font-medium">Base</th>
                    <th className="text-right py-2 text-xs text-stone-400 font-medium">Optimiste</th>
                    <th className="text-right py-2 text-xs text-stone-400 font-medium">Variation</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.year} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                      <td className="py-2.5 font-medium text-stone-900">{y.year} ans</td>
                      <td className="py-2.5 text-right font-mono text-stone-500 text-xs">
                        {formatPriceInCurrency(y.conservative_eur, currency, locale)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-emerald-700">
                        {formatPriceInCurrency(y.base_eur, currency, locale)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-stone-500 text-xs">
                        {formatPriceInCurrency(y.optimistic_eur, currency, locale)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs text-amber-700 font-semibold">
                        +{y.base_roi_pct.toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-stone-400 text-sm">Données de projection non disponibles</div>
          )}

          <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-sm">
            <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Projections indicatives basées sur des taux de croissance historiques par catégorie d&apos;artiste. Non contractuelles.
              Le marché de l&apos;art comporte des risques de liquidité.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AddArtworkModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (data: any) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    artist_name: "",
    medium: "",
    dimensions: "",
    purchase_price_eur: "",
    purchase_date: "",
    purchase_source: "",
    notes: "",
  });

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.purchase_price_eur) return;
    setLoading(true);
    setError(null);
    try {
      await onAdd({
        ...form,
        purchase_price_eur: parseFloat(form.purchase_price_eur),
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erreur lors de l'ajout");
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: string, opts?: { type?: string; placeholder?: string; required?: boolean }) => (
    <div>
      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
        {label} {opts?.required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={opts?.type || "text"}
        value={(form as any)[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={opts?.placeholder}
        required={opts?.required}
        className="w-full px-3 py-2.5 border border-stone-200 rounded-sm text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-amber-400 transition-colors"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-sm border border-stone-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 sticky top-0 bg-white">
          <h2 className="font-serif text-stone-900 text-lg">Ajouter une œuvre</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {field("Titre", "title", { required: true, placeholder: "ex. Composition abstraite" })}
          {field("Artiste", "artist_name", { placeholder: "ex. Bernard Buffet" })}

          <div className="grid grid-cols-2 gap-4">
            {field("Médium", "medium", { placeholder: "Huile sur toile" })}
            {field("Dimensions", "dimensions", { placeholder: "ex. 60 × 80 cm" })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field("Prix d'achat (€)", "purchase_price_eur", {
              type: "number",
              required: true,
              placeholder: "2500",
            })}
            {field("Date d'achat", "purchase_date", { type: "date" })}
          </div>

          {field("Source (maison de vente, galerie…)", "purchase_source", {
            placeholder: "ex. Drouot — Paris",
          })}

          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Provenance, état, certificats…"
              rows={3}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-sm text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-amber-400 transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-sm">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-600">{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-stone-200 text-stone-600 text-sm font-medium rounded-sm hover:bg-stone-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !form.title || !form.purchase_price_eur}
              className="flex-1 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-sm hover:bg-stone-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <><Check className="w-4 h-4" /> Ajouter</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ArtworkRow({
  item,
  onDelete,
  onProjection,
  onToggleSale,
}: {
  item: PortfolioItem;
  onDelete: (id: string) => void;
  onProjection: (item: PortfolioItem) => void;
  onToggleSale: (id: string, current: boolean) => void;
}) {
  const positive = item.gain_pct >= 0;
  const { currency, locale } = useLanguageStore();
  const tierInfo = TIER_LABELS[item.artist_tier];

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors group"
    >
      {/* Image */}
      <div className="w-12 h-12 rounded-sm bg-stone-100 flex-shrink-0 overflow-hidden">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-5 h-5 text-stone-300" />
          </div>
        )}
      </div>

      {/* Title & artist */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-stone-900 truncate">{item.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-stone-400 truncate">{item.artist_name || "—"}</span>
          {tierInfo && (
            <span className={cn("text-2xs px-1.5 py-0.5 rounded-full border font-semibold", tierInfo.color)}>
              {tierInfo.label}
            </span>
          )}
          {item.is_for_sale && (
            <span className="text-2xs px-1.5 py-0.5 rounded-full border border-amber-200 text-amber-700 bg-amber-50 font-semibold">
              À vendre
            </span>
          )}
        </div>
      </div>

      {/* Purchase price */}
      <div className="hidden md:block text-right flex-shrink-0">
        <div className="text-xs text-stone-400 mb-0.5">Achat</div>
        <div className="font-mono text-sm text-stone-700">
          {formatPriceInCurrency(item.purchase_price_eur, currency, locale)}
        </div>
      </div>

      {/* Current value */}
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-stone-400 mb-0.5">Valeur est. <span className="text-stone-300" title="Estimation indicative basée sur comparables — hors frais">ⓘ</span></div>
        <div className="font-mono text-sm font-semibold text-stone-900">
          {formatPriceInCurrency(item.estimated_current_value_eur, currency, locale)}
        </div>
        <div className="text-2xs text-stone-300">indicatif</div>
      </div>

      {/* Gain */}
      <div className="text-right flex-shrink-0 w-20">
        <div className={cn("font-mono text-sm font-bold", positive ? "text-emerald-600" : "text-red-600")}>
          {positive ? "+" : ""}{item.gain_pct.toFixed(1)}%
        </div>
        <div className={cn("text-xs font-mono", positive ? "text-emerald-500" : "text-red-500")}>
          {positive ? "+" : ""}{formatPriceInCurrency(item.gain_eur, currency, locale)}
        </div>
      </div>

      {/* Projection 10y */}
      <div className="hidden lg:block text-right flex-shrink-0 w-24">
        <div className="text-xs text-stone-400 mb-0.5">Est. 10 ans</div>
        <div className="font-mono text-xs text-amber-700 font-semibold">
          {item.projection_10y ? formatPriceInCurrency(item.projection_10y, currency, locale) : "—"}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onProjection(item)}
          title="Voir projections"
          className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-sm transition-colors"
        >
          <BarChart2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onToggleSale(item.id, item.is_for_sale)}
          title={item.is_for_sale ? "Retirer de la vente" : "Mettre en vente"}
          className={cn(
            "p-1.5 rounded-sm transition-colors",
            item.is_for_sale
              ? "text-amber-600 bg-amber-50"
              : "text-stone-400 hover:text-amber-600 hover:bg-amber-50",
          )}
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          title="Supprimer"
          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

export default function PortfolioPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [projectionItem, setProjectionItem] = useState<PortfolioItem | null>(null);

  const { data, isLoading, mutate } = useSWR(
    "portfolio",
    () => portfolioApi.list().then((r) => r.data),
    { revalidateOnFocus: false },
  );

  const items: PortfolioItem[] = data?.items || [];
  const stats: PortfolioStats | null = data?.stats || null;

  const handleAdd = async (formData: any) => {
    await portfolioApi.add(formData);
    await mutate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette œuvre du portfolio ?")) return;
    await portfolioApi.remove(id);
    await mutate();
  };

  const handleToggleSale = async (id: string, current: boolean) => {
    await portfolioApi.update(id, { is_for_sale: !current });
    await mutate();
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#0a0a0b]">
      <Sidebar />
      <div className="flex-1 ml-[52px] min-w-0 flex flex-col">
        <TopBar
          title="Portfolio"
          subtitle={stats ? `${stats.item_count} œuvre${stats.item_count !== 1 ? "s" : ""} · valeur totale estimée` : "Suivez et projetez la valeur de votre collection"}
          actions={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-sm hover:bg-stone-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une œuvre
            </button>
          }
        />

        <main className="flex-1 px-8 py-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="card-luxury h-24 animate-pulse" />
                ))}
              </div>
              <div className="card-luxury divide-y divide-stone-100">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse px-5 py-4">
                    <div className="h-4 bg-stone-100 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-stone-50 rounded w-1/4" />
                  </div>
                ))}
              </div>
            </div>
          ) : items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <Package className="w-12 h-12 text-stone-200 mb-4" />
              <div className="font-serif text-xl text-stone-500 mb-2">Portfolio vide</div>
              <p className="text-sm text-stone-400 max-w-xs mb-6">
                Ajoutez vos acquisitions pour suivre leur valeur et obtenir des projections sur 5 à 50 ans.
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-5 py-3 bg-stone-900 text-white text-sm font-medium rounded-sm hover:bg-stone-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter votre première œuvre
              </button>
            </motion.div>
          ) : (
            <>
              {stats && <StatBanner stats={stats} />}

              <div className="card-luxury overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 px-5 py-3 border-b border-stone-100 bg-stone-50">
                  <div className="w-12 flex-shrink-0" />
                  <div className="flex-1 text-2xs text-stone-400 uppercase tracking-widest font-semibold">Œuvre</div>
                  <div className="hidden md:block text-2xs text-stone-400 uppercase tracking-widest font-semibold w-24 text-right">Achat</div>
                  <div className="text-2xs text-stone-400 uppercase tracking-widest font-semibold w-24 text-right">Valeur est.</div>
                  <div className="text-2xs text-stone-400 uppercase tracking-widest font-semibold w-20 text-right">P&L</div>
                  <div className="hidden lg:block text-2xs text-stone-400 uppercase tracking-widest font-semibold w-24 text-right">10 ans</div>
                  <div className="w-24 flex-shrink-0" />
                </div>

                <div className="divide-y divide-stone-100">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => (
                      <ArtworkRow
                        key={item.id}
                        item={item}
                        onDelete={handleDelete}
                        onProjection={setProjectionItem}
                        onToggleSale={handleToggleSale}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAdd && (
          <AddArtworkModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
        )}
        {projectionItem && (
          <ProjectionModal item={projectionItem} onClose={() => setProjectionItem(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
