// Chat area header: shows the active conversation title and the model selector.
import { ModelSelector } from "../ui/ModelSelector";

type ChatHeaderProps = {
  title: string;
  selectedModel: string | null;
  onSelectModel: (modelId: string) => void;
  onPreviewModel: (modelId: string | null) => void;
};

export function ChatHeader({ title, selectedModel, onSelectModel, onPreviewModel }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.03] px-3 py-3 backdrop-blur-xl sm:gap-4 sm:px-6 sm:py-4">
      <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-neutral-100">{title}</h1>
      <div className="shrink-0">
        <ModelSelector selectedModel={selectedModel} onSelectModel={onSelectModel} onPreviewModel={onPreviewModel} />
      </div>
    </header>
  );
}
