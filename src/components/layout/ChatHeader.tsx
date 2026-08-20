import { ModelSelector } from "../ui/ModelSelector";

type ChatHeaderProps = {
  selectedModel: string | null;
  onSelectModel: (modelId: string) => void;
  onPreviewModel: (modelId: string | null) => void;
};

export function ChatHeader({ selectedModel, onSelectModel, onPreviewModel }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-white/[0.03] px-6 py-4 backdrop-blur-xl">
      <h1 className="text-sm font-semibold tracking-tight text-neutral-100">New Conversation</h1>
      <ModelSelector selectedModel={selectedModel} onSelectModel={onSelectModel} onPreviewModel={onPreviewModel} />
    </header>
  );
}
