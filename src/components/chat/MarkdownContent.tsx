// Renders assistant message markdown with syntax-highlighted, copyable code blocks and scrollable tables.
import { useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";

type MarkdownContentProps = {
  content: string;
};

// rehype-highlight's default language set (lowlight's "common" bundle)
// already covers every language this app needs to support (JS, TS,
// Python, Java, C/C++, HTML, CSS, JSON, Bash, SQL, Markdown) -- only
// JSX/TSX need an explicit alias, since they aren't distinct highlight.js
// grammars and otherwise wouldn't be recognized by that exact fence name;
// they're aliased onto the JS/TS tokenizers, which already handle
// embedded tag syntax reasonably.
const rehypeHighlightOptions = {
  aliases: { jsx: "javascript", tsx: "typescript" },
};

// A small, unobtrusive copy affordance for one fenced code block --
// separate from the message-level Copy action (see MessageBubble) since a
// long reply often has several distinct snippets a user wants
// independently, and copying the whole message would include prose
// around them.
function CodeBlockCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy code block:", error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-neutral-200"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Renders a fenced code block's language label + copy button above the
// actual highlighted <pre><code>. rehype-highlight attaches a
// "language-xxx" class to the inner <code> element for any block with a
// detected/declared language, which is where the label below reads from --
// content itself (the raw text passed to react-markdown) is never touched,
// so what's stored in conversation history stays exactly what the model
// sent.
function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const codeElement = children as { props?: { className?: string; children?: unknown } } | undefined;
  const className = codeElement?.props?.className ?? "";
  const languageMatch = /language-(\w+)/.exec(className);
  const language = languageMatch?.[1];

  const rawText = extractText(codeElement?.props?.children);

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{language ?? "code"}</span>
        <CodeBlockCopyButton code={rawText} />
      </div>
      <pre {...props} className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

// A wide table (many columns) doesn't wrap the way prose does -- without
// this, it would force the whole bubble (and the page along with it)
// horizontally wider than the viewport instead of scrolling in place,
// the same failure mode a code block would have without its own
// overflow-x-auto above.
function Table(props: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="my-2 overflow-x-auto">
      <table {...props} />
    </div>
  );
}

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

// Assistant messages only (see MessageBubble) -- user input stays plain
// text. Streaming-safe: react-markdown just re-parses whatever content
// string it's given on every render, so a still-growing response (an
// unclosed code fence, a half-written list) renders its best-effort
// interpretation of the partial text and naturally resolves to the final
// rendering once the stream completes, with no special-casing needed here.
export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, rehypeHighlightOptions]]}
        components={{ pre: CodeBlock, table: Table }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
