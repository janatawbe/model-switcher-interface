import { ModelSelector } from "../ui/ModelSelector";

type ChatHeaderProps = {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
};

export function ChatHeader({ selectedModel, onSelectModel }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4">
      <div>
        <h1 className="text-sm font-semibold text-neutral-900">New Conversation</h1>
        <p className="text-xs text-neutral-400">Model Switcher Interface</p>
      </div>
      <ModelSelector selectedModel={selectedModel} onSelectModel={onSelectModel} />
    </header>
  );
}
