// lib/auth.ts
// JWT auth avec AsyncStorage (mobile) — équivalent du localStorage web

import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = 'nautilus_auth';
const BASE_URL = 'https://artalpha-backend-production.up.railway.app';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'starter' | 'investor' | 'pro' | 'institutional';
  token: string;
  is_verified?: boolean;
}

export async function getStoredAuth(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function setStoredAuth(auth: AuthUser): Promise<void> {
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export async function clearStoredAuth(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_KEY);
}

export async function getToken(): Promise<string | null> {
  const auth = await getStoredAuth();
  return auth?.token ?? null;
}

export async function login(
  email: string,
  password: string
): Promise<AuthUser> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Erreur ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    user_id: string;
    email: string;
    name?: string;
    plan?: string;
    is_verified?: boolean;
  };

  const user: AuthUser = {
    id: data.user_id,
    email: data.email,
    name: data.name,
    plan: (data.plan as AuthUser['plan']) ?? 'free',
    token: data.access_token,
    is_verified: data.is_verified,
  };

  await setStoredAuth(user);
  return user;
}

export async function logout(): Promise<void> {
  await clearStoredAuth();
}
