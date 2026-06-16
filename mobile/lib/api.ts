// lib/api.ts
// Fetch wrapper vers le backend Railway — adapté pour mobile (AsyncStorage)

import Constants from 'expo-constants';
import { getToken, clearStoredAuth } from './auth';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://artalpha-backend-production.up.railway.app';

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (res.status === 401) {
    await clearStoredAuth();
    const { logout } = (await import('@/store/auth')).useAuthStore.getState();
    logout();  // ← nettoyage complet + user→null → guard _layout.tsx redirige vers login
    throw new Error('Session expirée. Reconnectez-vous.');
  }

  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try { detail = (JSON.parse(text) as { detail?: string }).detail ?? detail; } catch {}
    throw new Error(detail);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Réponse non-JSON (${res.status}): ${text.slice(0, 100)}`);
  }
}

async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // No Content-Type — let fetch set it with the boundary for multipart

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const text = await res.text();

  if (res.status === 401) {
    await clearStoredAuth();
    const { logout } = (await import('@/store/auth')).useAuthStore.getState();
    logout();
    throw new Error('Session expirée. Reconnectez-vous.');
  }

  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try { detail = (JSON.parse(text) as { detail?: string }).detail ?? detail; } catch {}
    throw new Error(detail);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Réponse non-JSON (${res.status}): ${text.slice(0, 100)}`);
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => uploadFile<T>(path, formData),
};
