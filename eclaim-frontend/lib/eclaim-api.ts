/** Headers for public e-claim / registry API calls (API key from env). */
export function eclaimApiHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_ECLAIM_API_KEY || ""
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    accept: "application/json",
    ...extra,
  }
  if (key) headers["X-API-Key"] = key
  return headers
}
