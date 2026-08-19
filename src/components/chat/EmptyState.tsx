import { Sparkles } from "lucide-react";

const SUGGESTIONS = ["Explain something", "Brainstorm an idea", "Help me code"];

type EmptyStateProps = {
  onSuggestionSelect: (prompt: string) => void;
};

export function EmptyState({ onSuggestionSelect }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white">
        <Sparkles size={20} />
      </div>
      <h2 className="text-2xl font-semibold text-neutral-900">Model Switcher</h2>
      <p className="text-neutral-500">Explore AI your way.</p>
      <p className="text-sm text-neutral-400">Choose a model and start a conversation.</p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSuggestionSelect(prompt)}
            className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
