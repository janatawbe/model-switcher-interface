// Tests the You.com search integration: the pure result-shaping logic, and
// performWebSearch's HTTP handling with globalThis.fetch mocked (no real
// network calls, no real API key needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { performWebSearch, shapeResults, SearchError } from "./searchService.js";

test("shapeResults returns [] when results.web is missing or malformed", () => {
  assert.deepEqual(shapeResults(null), []);
  assert.deepEqual(shapeResults(undefined), []);
  assert.deepEqual(shapeResults({}), []);
  assert.deepEqual(shapeResults({ results: {} }), []);
  assert.deepEqual(shapeResults({ results: { web: "not-an-array" as unknown as [] } }), []);
});

test("shapeResults maps title/url/description to title/url/snippet", () => {
  const shaped = shapeResults({
    results: { web: [{ title: "Node.js", url: "https://nodejs.org/", description: "A JavaScript runtime." }] },
  });
  assert.deepEqual(shaped, [{ title: "Node.js", url: "https://nodejs.org/", snippet: "A JavaScript runtime." }]);
});

test("shapeResults falls back to the first snippet when description is missing", () => {
  const shaped = shapeResults({
    results: { web: [{ title: "Example", url: "https://example.com/", snippets: ["first snippet", "second"] }] },
  });
  assert.equal(shaped[0]?.snippet, "first snippet");
});

test("shapeResults drops results with no url", () => {
  const shaped = shapeResults({
    results: {
      web: [
        { title: "No URL", description: "missing url" },
        { title: "Has URL", url: "https://example.com/", description: "fine" },
      ],
    },
  });
  assert.equal(shaped.length, 1);
  assert.equal(shaped[0]?.url, "https://example.com/");
});

test("shapeResults caps results at 5", () => {
  const web = Array.from({ length: 12 }, (_, i) => ({
    title: `Result ${i}`,
    url: `https://example.com/${i}`,
    description: "desc",
  }));
  assert.equal(shapeResults({ results: { web } }).length, 5);
});

test("shapeResults tolerates missing title/description fields", () => {
  const shaped = shapeResults({ results: { web: [{ url: "https://example.com/" }] } });
  assert.deepEqual(shaped, [{ title: "", url: "https://example.com/", snippet: "" }]);
});

test("performWebSearch rejects with SearchError when YOU_API_KEY is not set", async () => {
  const original = process.env.YOU_API_KEY;
  delete process.env.YOU_API_KEY;
  try {
    await assert.rejects(() => performWebSearch("test query"), SearchError);
  } finally {
    if (original !== undefined) process.env.YOU_API_KEY = original;
  }
});

test("performWebSearch sends the query and API key, and shapes a successful response", async (t) => {
  process.env.YOU_API_KEY = "test-key";
  const fetchMock = t.mock.fn(async (url: string, init: RequestInit) => {
    assert.equal(url, "https://ydc-index.io/v1/search");
    assert.equal((init.headers as Record<string, string>)["X-API-Key"], "test-key");
    const body = JSON.parse(init.body as string) as { query: string; count: number };
    assert.equal(body.query, "latest iPhone model");
    assert.equal(body.count, 5);
    return new Response(
      JSON.stringify({
        results: { web: [{ title: "Apple iPhone", url: "https://apple.com/iphone", description: "The latest iPhone lineup." }] },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  const results = await performWebSearch("latest iPhone model");
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(results, [{ title: "Apple iPhone", url: "https://apple.com/iphone", snippet: "The latest iPhone lineup." }]);
});

test("performWebSearch raises SearchError on a non-OK HTTP response", async (t) => {
  process.env.YOU_API_KEY = "test-key";
  t.mock.method(globalThis, "fetch", async () => new Response("unauthorized", { status: 401 }));

  await assert.rejects(() => performWebSearch("test query"), SearchError);
});

test("performWebSearch raises SearchError on a malformed (non-JSON) response", async (t) => {
  process.env.YOU_API_KEY = "test-key";
  t.mock.method(globalThis, "fetch", async () => new Response("not json", { status: 200 }));

  await assert.rejects(() => performWebSearch("test query"), SearchError);
});

test("performWebSearch raises SearchError on a network failure", async (t) => {
  process.env.YOU_API_KEY = "test-key";
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network down");
  });

  await assert.rejects(() => performWebSearch("test query"), SearchError);
});

test("performWebSearch rejects an empty query without calling fetch", async (t) => {
  process.env.YOU_API_KEY = "test-key";
  const fetchMock = t.mock.fn(async () => new Response("{}", { status: 200 }));
  t.mock.method(globalThis, "fetch", fetchMock);

  await assert.rejects(() => performWebSearch("   "), SearchError);
  assert.equal(fetchMock.mock.callCount(), 0);
});
