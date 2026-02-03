import React, { useRef, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  addMessage,
  updateLastMessageContent,
  setStreaming,
  finalizeLastMessage,
} from "@/store/chatSlice";
import { mockAiService } from "@/services/api/mockAiService";
import { ragEngine as mockRAGEngine } from "@/services/rag/mockRAGEngine";
import { openAIRAGEngine } from "@/services/rag/openAIRAGEngine";
import { MessageItem } from "./MessageItem";
import { ChatInput } from "./ChatInput";
import { Attachment } from "@/types/chat";

export const ChatWindow: React.FC = () => {
  const dispatch = useAppDispatch();
  const { conversations, activeConversationId, isStreaming } = useAppSelector(
    (state) => state.chat,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );

  const [isRealEngine, setIsRealEngine] = React.useState(false);
  console.log("222", 222);
  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages, isStreaming]);

  // Check engine mode on mount
  useEffect(() => {
    const checkEngine = () => {
      const hasKey = !!localStorage.getItem("OPENAI_API_KEY");
      setIsRealEngine(hasKey);
    };
    checkEngine();
    // Listen for storage changes in case settings change
    window.addEventListener("storage", checkEngine);
    return () => window.removeEventListener("storage", checkEngine);
  }, []);

  const handleSend = async (content: string, attachments?: Attachment[]) => {
    if (!activeConversationId) return;

    // 1. Add User Message
    dispatch(
      addMessage({
        conversationId: activeConversationId,
        role: "user",
        content,
        attachments,
      }),
    );

    // 2. Add empty AI Message (Placeholder)
    dispatch(
      addMessage({
        conversationId: activeConversationId,
        role: "assistant",
        content: "",
      }),
    );
    dispatch(setStreaming(true));

    try {
      // Check if OpenAI Key is set to determine which engine to use
      const apiKey =
        localStorage.getItem("OPENAI_API_KEY") ||
        "sk-4EVaiOOCO95SvVh78XPgajAnVNB7lKcpM2tuGIRFScudhMvC";
      const useRealEngine = !!apiKey;
      console.log("useRealEngine1", useRealEngine);
      if (useRealEngine) {
        console.log("useRealEngine");
        // --- REAL LANGCHAIN RAG FLOW ---
        let fullResponse = "";
        await openAIRAGEngine.generateResponseStream(content, (chunk) => {
          fullResponse += chunk;
          dispatch(
            updateLastMessageContent({
              conversationId: activeConversationId,
              content: fullResponse,
            }),
          );
        });
      } else {
        // --- MOCK FLOW (Fallback) ---

        // 3. RAG Retrieval Step
        const retrievedDocs = await mockRAGEngine.retrieve(content);
        let fullResponse = "";

        if (retrievedDocs.length > 0) {
          // Simulate streaming the RAG response
          const ragResponse = mockRAGEngine.generateMockResponse(
            content,
            retrievedDocs,
          );
          const chunks = ragResponse.split("");
          for (const chunk of chunks) {
            await new Promise((resolve) => setTimeout(resolve, 20)); // Fast stream
            fullResponse += chunk;
            dispatch(
              updateLastMessageContent({
                conversationId: activeConversationId,
                content: fullResponse,
              }),
            );
          }
        } else {
          // Standard Mock Service (No RAG context found)
          await mockAiService.sendMessage(
            [
              ...activeConversation!.messages,
              { id: "temp", role: "user", content, createdAt: Date.now() },
            ],
            (chunk) => {
              fullResponse += chunk;
              dispatch(
                updateLastMessageContent({
                  conversationId: activeConversationId,
                  content: fullResponse,
                }),
              );
            },
          );
        }
      }
    } catch (error: any) {
      console.error("Failed to send message", error);
      // Show error in the chat
      dispatch(
        updateLastMessageContent({
          conversationId: activeConversationId,
          content: `Error: ${error.message || "Something went wrong."}`,
        }),
      );
    } finally {
      dispatch(setStreaming(false));
      dispatch(finalizeLastMessage({ conversationId: activeConversationId }));
    }
  };

  const handleStop = () => {
    dispatch(setStreaming(false));
    if (activeConversationId) {
      dispatch(finalizeLastMessage({ conversationId: activeConversationId }));
    }
  };

  if (!activeConversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-zinc-500">
        Select or create a conversation to start chatting.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-zinc-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="flex flex-col pb-4">
          {activeConversation.messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
          {activeConversation.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <p className="text-lg font-medium">How can I help you today?</p>
              <p className="text-sm text-zinc-600 mt-2">
                {localStorage.getItem("OPENAI_API_KEY")
                  ? "Using Real LangChain + OpenAI"
                  : "Using Local Mock Engine"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-zinc-950 px-4 pb-4">
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
};
