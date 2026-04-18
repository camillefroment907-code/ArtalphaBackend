/**
 * apiClient.ts — self-healing API client with retry, token refresh, and circuit breaker.
 *
 * Features:
 * - Automatic retry on 5xx with exponential backoff (max 3 retries)
 * - 401 → clears auth + redirects to login (prevents silent auth failures)
 * - Circuit breaker: after 5 consecutive failures, pauses requests for 30s
 * - Request deduplication: concurrent identical GETs share the same promise
 * - Timeout: 15s default per request
 */

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const CIRCUIT_BREAK_THRESHOLD = 5;
const CIRCUIT_BREAK_RESET_MS = 30_000;

// ── Circuit breaker state ─────────────────────────────────────────────────────
let _failureCount = 0;
let _circuitOpenAt: number | null = null;

function _isCircuitOpen(): boolean {
  if (_circuitOpenAt === null) return false;
  if (Date.now() - _circuitOpenAt > CIRCUIT_BREAK_RESET_MS) {
    _circuitOpenAt = null;
    _failureCount = 0;
    return false;
  }
  return true;
}

function _recordSuccess() { _failureCount = 0; }
function _recordFailure() {
  _failureCount++;
  if (_failureCount >= CIRCUIT_BREAK_THRESHOLD) _circuitOpenAt = Date.now();
}

// ── In-flight request deduplication ──────────────────────────────────────────
const _inflight = new Map<string, Promise<any>>();

// ── Auth helpers ──────────────────────────────────────────────────────────────
function _getToken(): string | null {
  try { return JSON.parse(localStorage.getItem('artalpha_auth') || 'null')?.token ?? null; }
  catch { return null; }
}

function _clearAuth() {
  localStorage.removeItem('artalpha_auth');
}

// ── Core fetch with retry ─────────────────────────────────────────────────────
async function _fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);

    if (res.status === 401) {
      _clearAuth();
      // Redirect to login only in browser context
      if (typeof window !== 'undefined') {
        window.location.href = '/app/login';
      }
      throw new Error('Unauthorized — redirecting to login');
    }

    if (res.status >= 500 && retries > 0) {
      const delay = 2 ** (MAX_RETRIES - retries) * 500; // 500ms, 1s, 2s
      await new Promise(r => setTimeout(r, delay));
      return _fetchWithRetry(url, options, retries - 1, timeoutMs);
    }

    _recordSuccess();
    return res;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    if (retries > 0 && err.message !== 'Unauthorized — redirecting to login') {
      const delay = 2 ** (MAX_RETRIES - retries) * 500;
      await new Promise(r => setTimeout(r, delay));
      return _fetchWithRetry(url, options, retries - 1, timeoutMs);
    }
    _recordFailure();
    throw err;
  }
}

// ── Public interface ──────────────────────────────────────────────────────────

interface RequestOptions {
  auth?: boolean;          // attach Bearer token (default: true)
  timeout?: number;        // ms (default: 15000)
  dedupe?: boolean;        // deduplicate concurrent GET requests (default: true)
  retries?: number;        // override retry count
}

export async function apiGet<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (_isCircuitOpen()) throw new Error('Service temporarily unavailable (circuit open)');

  const { auth = true, timeout = DEFAULT_TIMEOUT_MS, dedupe = true, retries = MAX_RETRIES } = opts;
  const url = `${BACKEND}${path}`;
  const dedupeKey = url;

  if (dedupe && _inflight.has(dedupeKey)) {
    return _inflight.get(dedupeKey)!;
  }

  const headers: Record<string, string> = {};
  if (auth) {
    const token = _getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const promise = _fetchWithRetry(url, { method: 'GET', headers }, retries, timeout)
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.detail || `HTTP ${res.status}`), { status: res.status });
      return data as T;
    })
    .finally(() => { if (dedupe) _inflight.delete(dedupeKey); });

  if (dedupe) _inflight.set(dedupeKey, promise);
  return promise;
}

export async function apiPost<T = any>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  if (_isCircuitOpen()) throw new Error('Service temporarily unavailable (circuit open)');

  const { auth = true, timeout = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES } = opts;
  const url = `${BACKEND}${path}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = _getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await _fetchWithRetry(url, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined }, retries, timeout);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.detail || `HTTP ${res.status}`), { status: res.status });
  return data as T;
}

export async function apiPatch<T = any>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const { auth = true, timeout = DEFAULT_TIMEOUT_MS, retries = 1 } = opts;
  const url = `${BACKEND}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) { const token = _getToken(); if (token) headers['Authorization'] = `Bearer ${token}`; }
  const res = await _fetchWithRetry(url, { method: 'PATCH', headers, body: body ? JSON.stringify(body) : undefined }, retries, timeout);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.detail || `HTTP ${res.status}`), { status: res.status });
  return data as T;
}

export async function apiDelete<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { auth = true, timeout = DEFAULT_TIMEOUT_MS } = opts;
  const url = `${BACKEND}${path}`;
  const headers: Record<string, string> = {};
  if (auth) { const token = _getToken(); if (token) headers['Authorization'] = `Bearer ${token}`; }
  const res = await _fetchWithRetry(url, { method: 'DELETE', headers }, 1, timeout);
  if (res.status === 204) return {} as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.detail || `HTTP ${res.status}`), { status: res.status });
  return data as T;
}
