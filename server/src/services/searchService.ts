// Server-side You.com web search, used by the chat model's web_search tool.
const YOU_SEARCH_URL = "https://ydc-index.io/v1/search";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

// Keeps a slow/hanging search request from stalling a chat reply.
const SEARCH_TIMEOUT_MS = 8000;
const MAX_RESULTS = 5;
// Defends against pathological tool-call input, not a real search need.
const MAX_QUERY_LENGTH = 300;

// Raised for any search failure; callers turn this into a tool result the model can react to.
export class SearchError extends Error {}

function getApiKey(): string {
  const key = process.env.YOU_API_KEY;
  if (!key) {
    throw new SearchError("Web search is not configured on the server.");
  }
  return key;
}

// Runs a You.com web search and returns a small, model-friendly result list.
// Never returns raw provider errors -- only a SearchError with a safe message.
export async function performWebSearch(rawQuery: string): Promise<WebSearchResult[]> {
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) {
    throw new SearchError("Search query must not be empty.");
  }

  const apiKey = getApiKey();
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), SEARCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(YOU_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ query, count: MAX_RESULTS }),
      signal: timeoutController.signal,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.error(
      isTimeout
        ? `[searchService] You.com search timed out after ${SEARCH_TIMEOUT_MS}ms for query: "${query}"`
        : `[searchService] You.com search failed for query "${query}":`,
      isTimeout ? "" : error,
    );
    throw new SearchError(isTimeout ? "Web search timed out." : "Web search failed.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "<unreadable response body>");
    // Log the real upstream error server-side; callers only see a safe message.
    console.error(
      `[searchService] You.com search failed for query "${query}": ${response.status} ${response.statusText}\n${body}`,
    );
    throw new SearchError("Web search failed.");
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    console.error(`[searchService] You.com returned a malformed (non-JSON) response for query "${query}"`);
    throw new SearchError("Web search returned a malformed response.");
  }

  return shapeResults(parsed as RawYouResponse);
}

// Shape of the fields we read from You.com's response, kept minimal and
// exported so tests can exercise the shaping logic without the network.
export type RawYouResult = { title?: string; url?: string; description?: string; snippets?: string[] };
export type RawYouResponse = { results?: { web?: RawYouResult[] } } | null | undefined;

// Turns a raw You.com response into a small, model-friendly result list.
// Tolerates missing/malformed fields; never throws.
export function shapeResults(response: RawYouResponse): WebSearchResult[] {
  const webResults = response?.results?.web;
  if (!Array.isArray(webResults)) {
    return [];
  }

  return webResults
    .slice(0, MAX_RESULTS)
    .map((result): WebSearchResult => ({
      title: (result.title ?? "").trim(),
      url: (result.url ?? "").trim(),
      snippet: (result.description ?? result.snippets?.[0] ?? "").trim(),
    }))
    .filter((result) => result.url.length > 0);
}
