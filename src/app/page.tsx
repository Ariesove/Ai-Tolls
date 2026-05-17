"use client";

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  createConversation,
  createConversationRemote,
  hydrateConversations,
  loadMessagesRemote,
} from "@/store/chatSlice";
import { hydrateFromDb as hydrateKbFromDb } from "@/services/rag/RAG";
import { ConversationSidebar } from "@/components/features/Common/ConversationSidebar";
import { ChatWindow } from "@/components/features/ChartComponent/ChatWindow";
import { ModelSelector } from "@/components/features/ChartComponent/ModelSelector";
import { KnowledgeBaseDialog } from "@/components/features/Common/KnowledgeBaseDialog";
import { SettingsDialog } from "@/components/features/Common/SettingsDialog";
import { Button } from "@/components/ui/Button";
import { BookOpen, Settings } from "lucide-react";

export default function Home() {
  const dispatch = useAppDispatch();
  const { conversations } = useAppSelector((state) => state.chat);
  const [isKbOpen, setIsKbOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        void hydrateKbFromDb();
        const data = await dispatch(hydrateConversations()).unwrap();
        if (!alive) return;
        if (data.length === 0) {
          const created = await dispatch(createConversationRemote()).unwrap();
          if (!alive) return;
          dispatch(loadMessagesRemote(created.id));
        } else {
          dispatch(loadMessagesRemote(data[0].id));
        }
      } catch {
        if (!alive) return;
        if (conversations.length === 0) {
          dispatch(createConversation());
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [dispatch, conversations.length]);

  return (
    <main className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <ConversationSidebar />
      {/* Main Chat Area */}
      <div className="flex h-full flex-1 flex-col relative">
        <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-6 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/50 z-10">
          <ModelSelector />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-100"
              onClick={() => setIsKbOpen(true)}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Knowledge Base
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-zinc-100"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <ChatWindow />

        <KnowledgeBaseDialog
          isOpen={isKbOpen}
          onClose={() => setIsKbOpen(false)}
        />
        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </main>
  );
}
