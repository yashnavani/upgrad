const STORAGE_KEY = "api_pipeline_root";

/** One spine per browser tab: all apiClient calls share it for backend correlation. */
export function getOrCreatePipelineRoot(): string {
  if (typeof window === "undefined") return "";
  try {
    let v = sessionStorage.getItem(STORAGE_KEY);
    if (!v) {
      v = crypto.randomUUID();
      sessionStorage.setItem(STORAGE_KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}

/** First path segment after leading slash → matches backend infer on /api/v1/{seg}/... */
export function inferFeaturePipelineFromEndpoint(endpoint: string): string {
  const path = endpoint.split("?")[0].replace(/^\//, "");
  const raw = path.split("/")[0] ?? "";
  const seg = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 63);
  return seg || "root";
}
