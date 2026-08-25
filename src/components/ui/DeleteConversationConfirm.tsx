// Confirmation dialog shown before permanently deleting a conversation.
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";

type DeleteConversationConfirmProps = {
  conversationTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteConversationConfirm({ conversationTitle, onConfirm, onCancel }: DeleteConversationConfirmProps) {
  return (
    <ConfirmDialog
      headingId="delete-conversation-heading"
      heading="Delete this conversation?"
      description={
        <>
          &ldquo;{conversationTitle}&rdquo; will be permanently removed. This can&rsquo;t be undone.
        </>
      }
      topContent={
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300">
          <Trash2 size={18} />
        </div>
      }
      cancelLabel="Cancel"
      confirmLabel="Delete"
      confirmClassName="bg-red-500 hover:bg-red-400 text-white"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
