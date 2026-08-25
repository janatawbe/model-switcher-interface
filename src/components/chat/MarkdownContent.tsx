// Renders assistant message markdown with syntax-highlighted, copyable code blocks and scrollable tables.
import { useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";

type MarkdownContentProps = {
  content: string;
};

// Maps JSX/TSX fences onto the JS/TS highlighters.
const rehypeHighlightOptions = {
  aliases: { jsx: "javascript", tsx: "typescript" },
};

// Copies just this one code block, separate from the message-level Copy.
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

// Adds a language label and copy button above a highlighted code block.
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

// Wraps wide tables so they scroll instead of overflowing the page.
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

// Re-renders on every change, so it works safely with streaming content.
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
