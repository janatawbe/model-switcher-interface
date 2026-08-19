import { MODELS } from "./models";

type ModelSelectorProps = {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
};

export function ModelSelector({ selectedModel, onSelectModel }: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 p-1">
      {MODELS.map((model) => {
        const isActive = model.id === selectedModel;
        const Icon = model.icon;
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onSelectModel(model.id)}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Icon size={15} />
            {model.label}
          </button>
        );
      })}
    </div>
  );
}
