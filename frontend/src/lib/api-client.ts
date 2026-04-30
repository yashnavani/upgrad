import { APIError } from "./api-error";
import {
  getOrCreatePipelineRoot,
  inferFeaturePipelineFromEndpoint,
} from "./pipeline";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
).replace(/\/$/, "");

/** Base URL for v1 API (e.g. binary responses not handled by {@link apiClient}). */
export function getApiV1BaseUrl(): string {
  return API_URL;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) =>
        typeof d === "object" && d !== null && "msg" in d
          ? String((d as { msg: string }).msg)
          : JSON.stringify(d)
      )
      .join("; ");
  }
  return "An API error occurred.";
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extra options for {@link apiClient} (not passed to `fetch`). */
export type ApiClientOptions = RequestInit & {
  /** When true, do not retry on 5xx (e.g. optional features). */
  skipRetries?: boolean;
};

/**
 * Browser API client with retry logic and enhanced error handling.
 */
export async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const { skipRetries, ...fetchInit } = options;

  const body = fetchInit.body;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const headers = new Headers(fetchInit.headers);
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const formattedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const featureSlug = inferFeaturePipelineFromEndpoint(formattedEndpoint);
  headers.set("X-Feature-Pipeline", featureSlug);
  const pipelineRoot = getOrCreatePipelineRoot();
  if (pipelineRoot) {
    headers.set("X-Pipeline-Root", pipelineRoot);
  }

  const fullUrl = `${API_URL}${formattedEndpoint}`;

  let lastError: APIError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(fullUrl, {
        ...fetchInit,
        headers,
      });

      const requestId = response.headers.get("X-Request-ID") || undefined;

      if (response.status === 401) {
        throw new APIError("Unauthorized", 401, undefined, requestId);
      }

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({
          detail: response.statusText,
        }))) as { detail?: unknown };

        const errorMessage = formatErrorDetail(
          errorData.detail ?? response.statusText
        );

        const error = new APIError(
          errorMessage,
          response.status,
          errorData,
          requestId
        );

        if (response.status >= 500 && attempt < MAX_RETRIES && !skipRetries) {
          console.warn(
            `Server error (${response.status}), retrying... (attempt ${attempt}/${MAX_RETRIES})`
          );
          lastError = error;
          await delay(RETRY_DELAY * attempt);
          continue;
        }

        throw error;
      }

      if (response.status === 204) {
        return null as T;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        console.warn(
          `Network error, retrying... (attempt ${attempt}/${MAX_RETRIES})`
        );
        lastError = new APIError(
          error instanceof Error ? error.message : "Network error",
          0
        );
        await delay(RETRY_DELAY * attempt);
        continue;
      }

      throw new APIError(
        error instanceof Error ? error.message : "Network error",
        0
      );
    }
  }

  throw lastError || new APIError("Request failed after retries", 0);
}

/** Gemini voice TTS for voice-only interview (returns WAV blob). */
export async function postInterviewVoiceTts(text: string): Promise<Blob> {
  const formattedEndpoint = "/interviews/voice-tts";
  const headers = new Headers({ "Content-Type": "application/json" });
  const featureSlug = inferFeaturePipelineFromEndpoint(formattedEndpoint);
  headers.set("X-Feature-Pipeline", featureSlug);
  const pipelineRoot = getOrCreatePipelineRoot();
  if (pipelineRoot) {
    headers.set("X-Pipeline-Root", pipelineRoot);
  }
  const fullUrl = `${API_URL}${formattedEndpoint}`;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 120_000);
  try {
    const response = await fetch(fullUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
      signal: ac.signal,
    });
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({
        detail: response.statusText,
      }))) as { detail?: unknown };
      const errorMessage = formatErrorDetail(
        errorData.detail ?? response.statusText,
      );
      throw new APIError(errorMessage, response.status, errorData);
    }
    return response.blob();
  } finally {
    clearTimeout(to);
  }
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: "GET" });
}

export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function apiPut<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function apiPatch<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: "DELETE" });
}
