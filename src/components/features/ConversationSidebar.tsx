import React from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  createConversation,
  setActiveConversation,
  deleteConversation,
} from "@/store/chatSlice";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export const ConversationSidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { conversations, activeConversationId } = useAppSelector(
    (state) => state.chat,
  );

  const handleCreate = () => {
    dispatch(createConversation());
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch(deleteConversation(id));
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="p-4">
        <Button
          onClick={handleCreate}
          className="w-full justify-start gap-2 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white border border-zinc-700"
          variant="secondary"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => dispatch(setActiveConversation(conversation.id))}
              className={cn(
                "group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                activeConversationId === conversation.id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
              )}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{conversation.title}</span>
              </div>
              <button
                onClick={(e) => handleDelete(e, conversation.id)}
                className="hidden text-zinc-500 hover:text-red-400 group-hover:block"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {conversations.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No conversations yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
