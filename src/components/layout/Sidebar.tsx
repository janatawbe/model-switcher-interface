import { Plus, Sparkles } from "lucide-react";

type SidebarProps = {
  onNewChat: () => void;
};

export function Sidebar({ onNewChat }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
          <Sparkles size={16} />
        </div>
        <span className="text-sm font-semibold text-neutral-900">
          Model Switcher Interface
        </span>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto px-3">
        <p className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
          Recent
        </p>
        <p className="mt-3 px-1 text-sm text-neutral-400">No conversations yet</p>
      </div>
    </aside>
  );
}
