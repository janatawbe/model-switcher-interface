// Confirmation dialog shown when switching models mid-conversation.
import { ArrowRight } from "lucide-react";
import { getModel } from "./models";
import { ConfirmDialog } from "./ConfirmDialog";

type ModelSwitchConfirmProps = {
  fromModelId: string;
  toModelId: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Shown only when the user tries to switch models mid-conversation --
// silently reassigning an in-progress chat to a different model would make
// it look like that model said things it never did. Cancelling leaves the
// current model/conversation completely untouched; confirming switches
// models and starts a fresh conversation. See ConfirmDialog for the shared
// portal/backdrop/Escape-to-cancel treatment.
export function ModelSwitchConfirm({ fromModelId, toModelId, onConfirm, onCancel }: ModelSwitchConfirmProps) {
  const fromModel = getModel(fromModelId);
  const toModel = getModel(toModelId);
  if (!fromModel || !toModel) return null;
  const FromIcon = fromModel.icon;
  const ToIcon = toModel.icon;

  return (
    <ConfirmDialog
      headingId="model-switch-heading"
      heading="Start a new conversation?"
      description={
        <>
          Switching to {toModel.label} starts a fresh conversation. Your current chat with {fromModel.label} will be
          cleared from view.
        </>
      }
      topContent={
        <>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Switch model</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] ${fromModel.accent.text}`}
              >
                <FromIcon size={18} />
              </span>
              <span className="text-xs text-neutral-400">{fromModel.label}</span>
            </div>
            <ArrowRight size={16} className="shrink-0 text-neutral-600" />
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border bg-white/[0.06] ${toModel.accent.border} ${toModel.accent.text}`}
              >
                <ToIcon size={18} />
              </span>
              <span className="text-xs font-medium text-neutral-100">{toModel.label}</span>
            </div>
          </div>
        </>
      }
      cancelLabel={`Keep ${fromModel.label}`}
      confirmLabel="Switch & New Chat"
      confirmClassName={toModel.accent.solidButton}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
