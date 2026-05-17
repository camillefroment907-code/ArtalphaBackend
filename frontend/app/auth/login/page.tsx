"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, AlertCircle, TrendingUp, Shield, Zap, Globe, ChevronRight } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const LIVE_STATS = [
  "🎨 Bernard Buffet — 58% sous estimation — Score 94/100",
  "🔥 Marc Chagall — Deal détecté il y a 3 minutes",
  "📈 Joan Miró — +340% en 20 ans — À vendre maintenant",
  "⚡ Andy Warhol — Sous-évalué de 48% — Vente dans 2h",
  "💎 Niki de Saint Phalle — Score 89/100 — Opportunité rare",
  "🏛️ Pierre Soulages — Estimation basse dépassée — Score 91/100",
];

const SOCIAL_PROOF = [
  { name: "Jean-Philippe M.", role: "Collectionneur — Paris", text: "J'ai trouvé un Buffet à 620€ estimé 1 500€. Revendu 2 100€ huit mois plus tard. ArtAlpha me fait gagner des heures chaque semaine." },
  { name: "Sarah K.", role: "Galerie — Lyon", text: "Le meilleur outil du marché. Je scanne 3 000 lots/semaine sans lever le petit doigt. Indispensable." },
  { name: "Marc D.", role: "Family Office — Genève", text: "15% de rendement annuel sur mes acquisitions ArtAlpha depuis 18 mois. Ce n'est pas de la chance, c'est de l'intelligence." },
];

const VALUE_PROPS = [
  {
    icon: TrendingUp,
    title: "Intelligence marché temps réel",
    desc: "Scoring 0–100 sur 3 000 lots/semaine. Les deals en dessous de leur cote, détectés avant tout le monde.",
  },
  {
    icon: Zap,
    title: "Alertes instantanées",
    desc: "Email, SMS, WhatsApp ou Telegram. Soyez prévenu avant que le marteau ne tombe.",
  },
  {
    icon: Shield,
    title: "Portfolio & projections",
    desc: "Suivez la valeur de votre collection. Projections sur 5, 10, 20 et 50 ans.",
  },
  {
    icon: Globe,
    title: "5 langues, 5 devises",
    desc: "FR · EN · ES · ZH · AR. Prix convertis en temps réel dans votre devise.",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, setPlan } = useAuthStore();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  // Keep a stable ref to the GIS callback so the initialized handler always has fresh closures
  const gisCallbackRef = useRef<((resp: { credential: string }) => void) | null>(null);
  gisCallbackRef.current = async (response: { credential: string }) => {
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Erreur Google");
      }
      const data = await res.json();
      setAuth({ id: data.user_id, email: data.email }, data.access_token);
      if (data.plan) setPlan(data.plan as any);
      router.push(redirect);
    } catch (err: any) {
      setError(err.message || "Connexion Google échouée");
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as any).google?.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: { credential: string }) => gisCallbackRef.current?.(resp),
      });
    };
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  const handleGoogleLogin = () => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      setError("Google OAuth non configuré sur ce serveur");
      return;
    }
    (window as any).google?.accounts.id.prompt();
  };

  useEffect(() => {
    const t1 = setInterval(() => setTickerIndex((i) => (i + 1) % LIVE_STATS.length), 3000);
    const t2 = setInterval(() => setTestimonialIndex((i) => (i + 1) % SOCIAL_PROOF.length), 5000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await authApi.login(email, password);
      setAuth({ id: data.user_id, email: data.email }, data.access_token);
      if (data.plan) setPlan(data.plan as any);
      router.push(redirect);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0c0a09] overflow-hidden">
      {/* LEFT — Value proposition */}
      <div className="hidden lg:flex lg:w-[58%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Ambient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/30 via-transparent to-stone-950" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-700/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-600/5 rounded-full blur-2xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(201,168,76,1) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,1) 1px, transparent 1px)",
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-700 rounded-sm flex items-center justify-center">
              <span className="text-white font-serif text-lg font-bold">H</span>
            </div>
            <div>
              <div className="text-white font-serif text-xl tracking-widest">ArtAlpha</div>
              <div className="text-amber-600 text-xs tracking-widest uppercase">Art Investment Intelligence</div>
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-xl">
          {/* Live ticker */}
          <div className="mb-8 flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
            <AnimatePresence mode="wait">
              <motion.div
                key={tickerIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-xs text-emerald-400 font-medium"
              >
                {LIVE_STATS[tickerIndex]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Main headline */}
          <h1 className="font-serif text-white leading-[1.1] mb-6">
            <span className="text-5xl xl:text-6xl block">L&apos;art est</span>
            <span className="text-5xl xl:text-6xl block text-amber-400">l&apos;actif qui</span>
            <span className="text-5xl xl:text-6xl block">surperforme.</span>
          </h1>

          <p className="text-stone-400 text-lg leading-relaxed mb-8">
            +14% par an sur 50 ans. Plus performant que l&apos;immobilier, l&apos;or, les actions. La
            plupart des collectionneurs achètent à l&apos;aveugle.{" "}
            <span className="text-white font-medium">Vous, non.</span>
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { value: "3 000+", label: "lots scannés/semaine" },
              { value: "94%", label: "précision des deals" },
              { value: "+340%", label: "ROI moyen 20 ans" },
            ].map(({ value, label }) => (
              <div key={label} className="border border-white/10 rounded-sm p-3 bg-white/[0.02]">
                <div className="font-mono text-xl text-amber-400 font-bold">{value}</div>
                <div className="text-xs text-stone-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Value props */}
          <div className="space-y-3 mb-10">
            {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-700/20 border border-amber-700/30 rounded-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{title}</div>
                  <div className="text-stone-500 text-xs mt-0.5 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <AnimatePresence mode="wait">
            <motion.div
              key={testimonialIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="border border-white/10 rounded-sm p-4 bg-white/[0.02]"
            >
              <p className="text-stone-300 text-sm italic leading-relaxed mb-3">
                &ldquo;{SOCIAL_PROOF[testimonialIndex].text}&rdquo;
              </p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-700/30 rounded-full flex items-center justify-center text-amber-600 text-xs font-bold flex-shrink-0">
                  {SOCIAL_PROOF[testimonialIndex].name[0]}
                </div>
                <div>
                  <div className="text-white text-xs font-medium">{SOCIAL_PROOF[testimonialIndex].name}</div>
                  <div className="text-stone-500 text-xs">{SOCIAL_PROOF[testimonialIndex].role}</div>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-amber-500 text-xs">★</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Press mentions */}
        <div className="relative z-10">
          <div className="text-stone-600 text-xs mb-3 uppercase tracking-widest">Mentionné dans</div>
          <div className="flex items-center gap-6 opacity-30">
            {["Le Monde", "Les Échos", "Forbes", "Artprice"].map((p) => (
              <span key={p} className="text-stone-400 text-sm font-serif">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — Login form */}
      <div className="flex-1 lg:max-w-sm xl:max-w-md flex flex-col justify-center px-8 lg:px-10 bg-[#0f0e0d] border-l border-white/[0.06]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm mx-auto"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-amber-700 rounded-sm flex items-center justify-center">
              <span className="text-white font-serif text-base font-bold">H</span>
            </div>
            <span className="text-white font-serif text-lg tracking-widest">ArtAlpha</span>
          </div>

          <div className="mb-8">
            <h2 className="text-white font-serif text-2xl mb-1">Connexion</h2>
            <p className="text-stone-500 text-sm">Accédez à votre intelligence du marché</p>
          </div>

          {/* Demo credentials */}
          <div className="mb-6 p-3 rounded-sm border border-amber-700/30 bg-amber-700/10">
            <div className="text-amber-600 text-xs font-semibold uppercase tracking-wider mb-1">Accès démo</div>
            <div className="text-stone-300 text-xs font-mono">demo@balthus.art · demo1234</div>
          </div>

          {/* Google OAuth button — GIS One Tap flow */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 border border-white/15 rounded-sm text-sm text-stone-300 hover:bg-white/[0.04] hover:border-white/25 transition-all duration-200 mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continuer avec Google
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[#0f0e0d] text-xs text-stone-600">ou avec votre email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-sm text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-amber-600/50 focus:bg-white/[0.06] transition-all"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-10 bg-white/[0.04] border border-white/10 rounded-sm text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-amber-600/50 focus:bg-white/[0.06] transition-all"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-400 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-sm bg-red-900/20 border border-red-800/30"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400">{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3.5 bg-amber-700 text-white text-sm font-medium rounded-sm hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <>
                  Se connecter <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-stone-600">
            Pas encore membre ?{" "}
            <Link href="/auth/register" className="text-amber-600 hover:text-amber-500 font-medium transition-colors">
              Inscription gratuite →
            </Link>
          </p>

          <p className="mt-3 text-center text-xs text-stone-700">
            En vous connectant, vous acceptez nos{" "}
            <a href="#" className="text-stone-500 hover:text-stone-400">
              CGU
            </a>{" "}
            et{" "}
            <a href="#" className="text-stone-500 hover:text-stone-400">
              politique de confidentialité
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0c0a09]" />}>
      <LoginForm />
    </Suspense>
  );
}
