"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      router.replace(`/auth/login?error=${error}`);
      return;
    }

    if (token) {
      // Store token first so the API call can authenticate
      setAuth({ id: "", email: "", full_name: "" } as any, token);
      // Fetch real user data from backend
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(u => {
          if (u?.id) setAuth({ id: String(u.id), email: u.email, full_name: u.full_name || "" }, token);
        })
        .catch(() => {})
        .finally(() => router.replace("/dashboard"));
    } else {
      router.replace("/auth/login?error=no_token");
    }
  }, [searchParams, setAuth, router]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-stone-500 text-sm">Connexion en cours...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
