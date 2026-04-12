import { getSession, signOut } from "next-auth/react";
import { APIError } from "./api-error";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
).replace(/\/$/, "");

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

/**
 * Browser API client with retry logic and enhanced error handling.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const session = await getSession();
  const token = session?.accessToken;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const formattedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${API_URL}${formattedEndpoint}`;

  let lastError: APIError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
      });

      const requestId = response.headers.get("X-Request-ID") || undefined;

      if (response.status === 401) {
        console.warn("Session expired or invalid; signing out.");
        await signOut({ redirect: false });
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
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

        if (response.status >= 500 && attempt < MAX_RETRIES) {
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

/**
 * GET request helper.
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: "GET" });
}

/**
 * POST request helper.
 */
export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request helper.
 */
export async function apiPut<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request helper.
 */
export async function apiPatch<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request helper.
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: "DELETE" });
}
