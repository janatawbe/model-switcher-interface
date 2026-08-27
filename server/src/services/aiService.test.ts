// Tests the tool-calling loop in aiService.ts. OpenRouter is mocked via
// globalThis.fetch -- no real network calls are made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { streamChatWithTools } from "./aiService.js";
import { ApiError } from "../types/ai.js";
import type { WebSearchResult } from "./searchService.js";

process.env.OPENROUTER_API_KEY = "test-key";

type FakeToolCall = { id: string; name: string; args: string };

// Builds a fake OpenRouter SSE response body from a small script of deltas.
function sseResponse(opts: { content?: string; toolCalls?: FakeToolCall[] }): Response {
  const lines: string[] = [];
  if (opts.toolCalls) {
    opts.toolCalls.forEach((call, index) => {
      lines.push(
        `data: ${JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index, id: call.id, function: { name: call.name, arguments: "" } }] } }],
        })}\n\n`,
      );
      // Split the arguments across two fragments, like a real provider stream would.
      const mid = Math.ceil(call.args.length / 2);
      for (const chunk of [call.args.slice(0, mid), call.args.slice(mid)]) {
        if (!chunk) continue;
        lines.push(
          `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index, function: { arguments: chunk } }] } }] })}\n\n`,
        );
      }
    });
  }
  if (opts.content) {
    for (const ch of opts.content) {
      lines.push(`data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`);
    }
  }
  lines.push("data: [DONE]\n\n");

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(lines.join("")));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function baseRequest() {
  return { model: "laguna" as const, messages: [{ role: "user" as const, content: "hello" }] };
}

async function readRequestBody(call: unknown): Promise<Record<string, unknown>> {
  const [, init] = call as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

test("normal chat without web search streams content and never calls the tool", async (t) => {
  const fetchMock = t.mock.fn(async () => sseResponse({ content: "Photosynthesis is..." }));
  t.mock.method(globalThis, "fetch", fetchMock);

  let received = "";
  let statusCalls = 0;
  const searchFn = async (): Promise<WebSearchResult[]> => {
    throw new Error("should not be called");
  };

  await streamChatWithTools(baseRequest(), (d) => (received += d), () => statusCalls++, searchFn);

  assert.equal(received, "Photosynthesis is...");
  assert.equal(statusCalls, 0);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("detects a tool call, runs the search, and streams the final answer", async (t) => {
  let call = 0;
  const fetchMock = t.mock.fn(async () => {
    call++;
    if (call === 1) {
      return sseResponse({ toolCalls: [{ id: "call_1", name: "web_search", args: '{"query":"latest iPhone releases"}' }] });
    }
    return sseResponse({ content: "The latest iPhone is..." });
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  let received = "";
  const statuses: string[] = [];
  let searchedQuery = "";
  const searchFn = async (query: string): Promise<WebSearchResult[]> => {
    searchedQuery = query;
    return [{ title: "Apple", url: "https://apple.com/iphone", snippet: "Latest iPhone lineup." }];
  };

  await streamChatWithTools(baseRequest(), (d) => (received += d), (s) => statuses.push(s), searchFn);

  assert.equal(received, "The latest iPhone is...");
  assert.deepEqual(statuses, ["Searching the web..."]);
  assert.equal(searchedQuery, "latest iPhone releases");
  assert.equal(fetchMock.mock.callCount(), 2);

  const secondBody = await readRequestBody(fetchMock.mock.calls[1]!.arguments);
  const messages = secondBody.messages as Array<{ role: string; content?: string; tool_call_id?: string }>;
  const toolMessage = messages.find((m) => m.role === "tool");
  assert.ok(toolMessage, "expected a tool result message to be sent back to the model");
  assert.equal(toolMessage!.tool_call_id, "call_1");
  const parsed = JSON.parse(toolMessage!.content!) as { results: WebSearchResult[] };
  assert.equal(parsed.results[0]?.url, "https://apple.com/iphone");
});

test("empty search results still let the model produce a final answer", async (t) => {
  let call = 0;
  const fetchMock = t.mock.fn(async () => {
    call++;
    if (call === 1) {
      return sseResponse({ toolCalls: [{ id: "call_1", name: "web_search", args: '{"query":"something obscure"}' }] });
    }
    return sseResponse({ content: "I could not find anything current." });
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  let received = "";
  const searchFn = async (): Promise<WebSearchResult[]> => [];

  await streamChatWithTools(baseRequest(), (d) => (received += d), undefined, searchFn);

  assert.equal(received, "I could not find anything current.");
  assert.equal(fetchMock.mock.callCount(), 2);

  const secondBody = await readRequestBody(fetchMock.mock.calls[1]!.arguments);
  const messages = secondBody.messages as Array<{ role: string; content?: string }>;
  const toolMessage = messages.find((m) => m.role === "tool");
  const parsed = JSON.parse(toolMessage!.content!) as { results: unknown[]; note?: string };
  assert.deepEqual(parsed.results, []);
  assert.ok(parsed.note);
});

test("a search failure is reported to the model, not thrown to the caller", async (t) => {
  let call = 0;
  const fetchMock = t.mock.fn(async () => {
    call++;
    if (call === 1) {
      return sseResponse({ toolCalls: [{ id: "call_1", name: "web_search", args: '{"query":"today\'s news"}' }] });
    }
    return sseResponse({ content: "I can't verify current news right now." });
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  let received = "";
  const searchFn = async (): Promise<WebSearchResult[]> => {
    throw new Error("network down");
  };

  await streamChatWithTools(baseRequest(), (d) => (received += d), undefined, searchFn);

  assert.equal(received, "I can't verify current news right now.");
  const secondBody = await readRequestBody(fetchMock.mock.calls[1]!.arguments);
  const messages = secondBody.messages as Array<{ role: string; content?: string }>;
  const toolMessage = messages.find((m) => m.role === "tool");
  const parsed = JSON.parse(toolMessage!.content!) as { error?: string };
  assert.ok(parsed.error && /unavailable/i.test(parsed.error));
});

test("malformed tool arguments are handled without crashing", async (t) => {
  let call = 0;
  const fetchMock = t.mock.fn(async () => {
    call++;
    if (call === 1) {
      return sseResponse({ toolCalls: [{ id: "call_1", name: "web_search", args: "{not valid json" }] });
    }
    return sseResponse({ content: "Here's what I know without searching." });
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  let received = "";
  const searchFn = async (): Promise<WebSearchResult[]> => {
    throw new Error("should not be called for malformed args");
  };

  await streamChatWithTools(baseRequest(), (d) => (received += d), undefined, searchFn);

  assert.equal(received, "Here's what I know without searching.");
  const secondBody = await readRequestBody(fetchMock.mock.calls[1]!.arguments);
  const messages = secondBody.messages as Array<{ role: string; content?: string }>;
  const toolMessage = messages.find((m) => m.role === "tool");
  const parsed = JSON.parse(toolMessage!.content!) as { error?: string };
  assert.ok(parsed.error);
});

test("stops after the maximum number of tool iterations and forces a final answer", async (t) => {
  const fetchMock = t.mock.fn(async (...args: unknown[]) => {
    const body = await readRequestBody(args);
    if (body.tools) {
      return sseResponse({ toolCalls: [{ id: `call_${fetchMock.mock.callCount()}`, name: "web_search", args: '{"query":"x"}' }] });
    }
    return sseResponse({ content: "Final answer after hitting the iteration cap." });
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  let received = "";
  let searchCalls = 0;
  const searchFn = async (): Promise<WebSearchResult[]> => {
    searchCalls++;
    return [{ title: "t", url: "https://example.com", snippet: "s" }];
  };

  await streamChatWithTools(baseRequest(), (d) => (received += d), undefined, searchFn);

  assert.equal(received, "Final answer after hitting the iteration cap.");
  // 3 tool-enabled rounds + 1 forced final round with no tools.
  assert.equal(fetchMock.mock.callCount(), 4);
  assert.equal(searchCalls, 3);
  const lastBody = await readRequestBody(fetchMock.mock.calls[3]!.arguments);
  assert.equal(lastBody.tools, undefined);
});

test("propagates a genuine OpenRouter failure as an ApiError (existing error handling)", async (t) => {
  const fetchMock = t.mock.fn(async () => new Response("server error", { status: 500 }));
  t.mock.method(globalThis, "fetch", fetchMock);

  await assert.rejects(
    () => streamChatWithTools(baseRequest(), () => {}, undefined, async () => []),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, "AI_PROVIDER_UNAVAILABLE");
      return true;
    },
  );
});

test("falls back to a plain request if the provider rejects the tools field", async (t) => {
  let call = 0;
  const fetchMock = t.mock.fn(async () => {
    call++;
    if (call === 1) return new Response("bad request", { status: 400 });
    return sseResponse({ content: "Answering without tool support." });
  });
  t.mock.method(globalThis, "fetch", fetchMock);

  let received = "";
  await streamChatWithTools(baseRequest(), (d) => (received += d), undefined, async () => []);

  assert.equal(received, "Answering without tool support.");
  assert.equal(fetchMock.mock.callCount(), 2);
  const secondBody = await readRequestBody(fetchMock.mock.calls[1]!.arguments);
  assert.equal(secondBody.tools, undefined);
});

test("the system prompt instructs a Sources section with markdown links and forbids bracket-style citations", async (t) => {
  const fetchMock = t.mock.fn(async () => sseResponse({ content: "Photosynthesis is..." }));
  t.mock.method(globalThis, "fetch", fetchMock);

  await streamChatWithTools(baseRequest(), () => {}, undefined, async () => []);

  const body = await readRequestBody(fetchMock.mock.calls[0]!.arguments);
  const messages = body.messages as Array<{ role: string; content: string }>;
  const systemMessage = messages.find((m) => m.role === "system");
  assert.ok(systemMessage, "expected a system message to be sent");

  const prompt = systemMessage!.content;
  assert.match(prompt, /Sources:/);
  assert.match(prompt, /\[Source title\]\(https:\/\/actual-url\.com\)/);
  assert.match(prompt, /never invent, guess, or reuse a URL/);
  assert.match(prompt, /【1†L1-L4】/);
  assert.match(prompt, /not add a Sources section/);
});

test("the system prompt includes today's real date and instructs comparing search-result dates against it", async (t) => {
  const fetchMock = t.mock.fn(async () => sseResponse({ content: "..." }));
  t.mock.method(globalThis, "fetch", fetchMock);

  await streamChatWithTools(baseRequest(), () => {}, undefined, async () => []);

  const body = await readRequestBody(fetchMock.mock.calls[0]!.arguments);
  const messages = body.messages as Array<{ role: string; content: string }>;
  const prompt = messages.find((m) => m.role === "system")!.content;

  const today = new Date().toISOString().slice(0, 10);
  assert.match(prompt, new RegExp(`Today's actual date is ${today}`));
  assert.match(prompt, /Never call something "upcoming" if its release or event date is on or before today/);
  assert.match(prompt, /verify whether it actually happened or released/);
  assert.match(prompt, /already released or occurred.*announced but not yet released.*cancelled, delayed, or postponed/s);
  assert.match(prompt, /search again before answering rather than guessing/);
  assert.match(prompt, /Never invent a release date/);
});
