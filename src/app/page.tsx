"use client";

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createConversation } from "@/store/chatSlice";
import { ConversationSidebar } from "@/components/features/ConversationSidebar";
import { ChatWindow } from "@/components/features/ChatWindow";
import { ModelSelector } from "@/components/features/ModelSelector";
import { KnowledgeBaseDialog } from "@/components/features/KnowledgeBaseDialog";
import { SettingsDialog } from "@/components/features/SettingsDialog";
import { Button } from "@/components/ui/Button";
import { BookOpen, Settings } from "lucide-react";

export default function Home() {
  const dispatch = useAppDispatch();
  const { conversations } = useAppSelector((state) => state.chat);
  const [isKbOpen, setIsKbOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize a conversation if none exists
  useEffect(() => {
    if (conversations.length === 0) {
      dispatch(createConversation());
    }
  }, [conversations.length, dispatch]);

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
