import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  createConversationRemote,
  setActiveConversation,
  deleteConversationRemote,
  loadMessagesRemote,
} from "@/store/chatSlice";
import {
  MessageSquare,
  Plus,
  Trash2,
  Code2,
  Database,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export const ConversationSidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const { conversations, activeConversationId } = useAppSelector(
    (state) => state.chat,
  );

  const handleCreate = () => {
    dispatch(createConversationRemote());
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch(deleteConversationRemote(id));
  };

  const navItems = [
    { label: "AI Chat", href: "/", icon: MessageSquare },
    { label: "Code Review", href: "/code-review", icon: Code2 },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-900 shadow-xl">
      {/* Navigation Links */}
      <div className="p-3 space-y-1 border-b border-zinc-800/50">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
              pathname === item.href
                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent",
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                pathname === item.href
                  ? "text-indigo-400"
                  : "text-zinc-500 group-hover:text-zinc-300",
              )}
            />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="p-4">
        <Button
          onClick={handleCreate}
          className="w-full justify-start gap-2 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all"
          variant="secondary"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="px-3 mb-2">
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
            History
          </span>
        </div>
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => {
                dispatch(setActiveConversation(conversation.id));
                dispatch(loadMessagesRemote(conversation.id));
              }}
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
