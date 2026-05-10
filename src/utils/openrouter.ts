/**
 * Minimal OpenRouter client used by Settings (model picker + key validation)
 * and the AI task generator.
 *
 * Docs: https://openrouter.ai/docs
 */

const BASE = 'https://openrouter.ai/api/v1';

export interface OpenRouterPricing {
  /** USD per token (string in API; e.g. "0.0000035"). */
  prompt: string;
  completion: string;
  request?: string;
  image?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string | null;
  };
  pricing?: OpenRouterPricing;
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: unknown;
  supported_parameters?: string[];
}

export interface ModelsResponse {
  data: OpenRouterModel[];
}

const DEFAULT_HEADERS = (apiKey?: string | null): HeadersInit => ({
  'Content-Type': 'application/json',
  // OpenRouter recommends these so traffic shows attribution in their dashboard.
  'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'taskforge',
  'X-Title': 'TaskForge',
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
});

const polishError = (status: number, body?: { error?: { message?: string } }): string => {
  const apiMsg = body?.error?.message;
  if (status === 401) return 'Nieprawidłowy klucz API.';
  if (status === 402) return 'Brak środków na koncie OpenRouter.';
  if (status === 403) return 'Brak dostępu do wybranego modelu.';
  if (status === 404) return 'Model nie istnieje lub został wycofany.';
  if (status === 408 || status === 504) return 'Przekroczono limit czasu odpowiedzi modelu.';
  if (status === 429) return 'Przekroczono limit zapytań — spróbuj za chwilę.';
  if (status >= 500) return apiMsg ? `Błąd serwera OpenRouter: ${apiMsg}` : 'Błąd po stronie OpenRouter.';
  return apiMsg ? apiMsg : `Niespodziewany błąd (HTTP ${status}).`;
};

export async function fetchModels(apiKey?: string | null): Promise<OpenRouterModel[]> {
  const res = await fetch(`${BASE}/models`, { headers: DEFAULT_HEADERS(apiKey) });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new Error(polishError(res.status, body));
  }
  const json = (await res.json()) as ModelsResponse;
  return Array.isArray(json.data) ? json.data : [];
}

export interface KeyInfo {
  /** Remaining credit in USD (or null when not provided by the API). */
  limit?: number | null;
  usage?: number;
  is_provisioning_key?: boolean;
  rate_limit?: { requests?: number; interval?: string };
  label?: string;
}

export async function fetchKeyInfo(apiKey: string): Promise<KeyInfo> {
  const res = await fetch(`${BASE}/auth/key`, { headers: DEFAULT_HEADERS(apiKey) });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new Error(polishError(res.status, body));
  }
  const json = await res.json();
  return (json?.data ?? json) as KeyInfo;
}

export interface GenerateOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  /** Force JSON output via the official response_format. */
  jsonMode?: boolean;
  /** Optional temperature override. */
  temperature?: number;
  /** Optional max output tokens. */
  maxTokens?: number;
  /** Abort controller for cancellation. */
  signal?: AbortSignal;
}

export interface GenerationResult {
  content: string;
  model: string;
  finishReason?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export async function generateChat(opts: GenerateOptions): Promise<GenerationResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };
  if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
  if (typeof opts.maxTokens === 'number') body.max_tokens = opts.maxTokens;

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: DEFAULT_HEADERS(opts.apiKey),
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => undefined);
    throw new Error(polishError(res.status, errBody));
  }
  const json = await res.json();
  const choice = json?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Model nie zwrócił treści (pusta odpowiedź).');
  }
  return {
    content,
    model: json?.model ?? opts.model,
    finishReason: choice?.finish_reason,
    usage: json?.usage,
  };
}

/** Helpers for ModelPicker / Settings UI. */

export const isFreeModel = (m: OpenRouterModel): boolean => {
  const p = parseFloat(m.pricing?.prompt ?? '0');
  const c = parseFloat(m.pricing?.completion ?? '0');
  return p === 0 && c === 0;
};

/** Format price as USD per million tokens — much more readable than per-token. */
export const formatMTokPrice = (perToken: string | undefined): string => {
  const v = parseFloat(perToken ?? '0');
  if (!Number.isFinite(v) || v === 0) return 'free';
  const perMillion = v * 1_000_000;
  if (perMillion < 0.01) return `$${perMillion.toFixed(4)}/MTok`;
  if (perMillion < 1) return `$${perMillion.toFixed(2)}/MTok`;
  return `$${perMillion.toFixed(1)}/MTok`;
};

export const providerOf = (m: OpenRouterModel): string => {
  // Model ids look like "google/gemini-1.5-flash" — provider is the prefix.
  const slash = m.id.indexOf('/');
  return slash > 0 ? m.id.slice(0, slash) : 'unknown';
};

export const supportsImageInput = (m: OpenRouterModel): boolean => {
  const inputs = m.architecture?.input_modalities;
  return Array.isArray(inputs) && inputs.includes('image');
};

export const supportsReasoning = (m: OpenRouterModel): boolean => {
  return Array.isArray(m.supported_parameters) && m.supported_parameters.includes('reasoning');
};

export const formatContext = (n: number | undefined): string => {
  if (!n || !Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tok`;
  if (n >= 1000) return `${Math.round(n / 1000)}k tok`;
  return `${n} tok`;
};
