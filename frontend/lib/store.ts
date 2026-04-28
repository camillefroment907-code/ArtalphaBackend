import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";

interface User {
  id: string;
  email: string;
  full_name?: string;
}

type Plan = "free" | "starter" | "investor" | "pro" | "expert" | "institutional";

interface AuthStore {
  user: User | null;
  token: string | null;
  plan: Plan;
  setAuth: (user: User, token: string) => void;
  setPlan: (plan: Plan) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      plan: "free",
      isAuthenticated: false,

      setAuth: (user, token) => {
        Cookies.set("hono_token", token, { expires: 7, sameSite: "strict" });
        set({ user, token, isAuthenticated: true });
      },

      setPlan: (plan) => set({ plan }),

      logout: () => {
        Cookies.remove("hono_token");
        set({ user: null, token: null, plan: "free", isAuthenticated: false });
      },
    }),
    {
      name: "hono-auth",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        plan: state.plan,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
