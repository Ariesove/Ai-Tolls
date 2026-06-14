"use client";
import React, { useRef, useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  addMessage,
  updateLastMessageContent,
  setStreaming,
  finalizeLastMessage,
  setLastMessageCitations,
  updateLastMessageAttachments,
} from "@/store/chatSlice";
import { getLLm, hydrateFromDb } from "@/services/rag/RAG";
import {
  appendMessage as appendMessageRemote,
  createConversation as upsertConversationRemote,
} from "@/services/api/chat";
import { v4 as uuidv4 } from "uuid";

import { processFunctionCall } from "@/services/functionCalling/functionCalling";
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
  const [isAtBottom, setIsAtBottom] = useState(true);

  const [isRealEngine, setIsRealEngine] = React.useState(false);
  console.log("222", 222);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // 判断是否“接近底部”（比如距离底部 < 10px）
      let c = scrollHeight - scrollTop - clientHeight;
      console.log("c", c);

      if (scrollHeight - scrollTop - clientHeight < 150) {
        setIsAtBottom(true);
      } else {
        setIsAtBottom(false);
      }
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // 判断是否“接近底部”（比如距离底部 < 10px）
      let c = scrollHeight - scrollTop - clientHeight;
      console.log("c", c);
      console.log("scrollHeight", scrollHeight, scrollTop, clientHeight);
      requestAnimationFrame(() => {
        // 【策略选择】流式高频更新用 'auto' 防卡顿，非流式用 'smooth' 做过渡
        const behavior = isStreaming ? "auto" : "smooth";
        if (scrollHeight - scrollTop - clientHeight < 150 && isAtBottom) {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: behavior,
          });
        }
      });
    }
  }, [activeConversation?.messages, isStreaming, isAtBottom]);

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

  useEffect(() => {
    void hydrateFromDb();
  }, []);

  const handleSend = async (content: string, attachments?: Attachment[]) => {
    if (!activeConversationId) return;

    const userCreatedAt = Date.now();
    const conv = activeConversation;
    void upsertConversationRemote({
      id: activeConversationId,
      title: conv?.title || "New Chat",
      createdAt: conv?.createdAt ?? userCreatedAt,
      updatedAt: Date.now(),
    });
    // 1. Add User Message
    dispatch(
      addMessage({
        conversationId: activeConversationId,
        role: "user",
        content,
        attachments,
      }),
    );
    void appendMessageRemote(activeConversationId, {
      id: uuidv4(),
      role: "user",
      content,
      createdAt: userCreatedAt,
      status: "sent",
      attachments,
    });

    // 2. Add empty AI Message (Placeholder)
    dispatch(
      addMessage({
        conversationId: activeConversationId,
        role: "assistant",
        content: "",
      }),
    );
    dispatch(setStreaming(true));

    let assistantContent = "";
    let assistantCitations: Array<{
      filename?: string;
      chunkIndex: number;
      preview: string;
      score?: number;
      content?: string;
      startLine?: number;
      endLine?: number;
      hitText?: string;
    }> | null = null;
    let hasError = false;

    try {
      // Check if OpenAI Key is set to determine which engine to use
      const apiKey = (localStorage.getItem("OPENAI_API_KEY") || "").trim();
      if (!apiKey) {
        throw new Error(
          "未配置 OPENAI_API_KEY：请在 Settings 中填写后再发送消息",
        );
      }

      console.log("useRealEngine");
      console.log("发送内容：", content);
      const result = await getLLm(
        content,
        (chunk) => {
          assistantContent = chunk;
          dispatch(
            updateLastMessageContent({
              conversationId: activeConversationId,
              content: chunk,
            }),
          );
        },
        attachments,
      );
      if (result && Array.isArray(result.citations)) {
        assistantCitations = result.citations;
        dispatch(
          setLastMessageCitations({
            conversationId: activeConversationId,
            citations: result.citations.map((c) => ({
              filename: c.filename,
              chunkIndex: c.chunkIndex,
              preview: c.preview,
              score: c.score,
              startLine: c.startLine,
              endLine: c.endLine,
              content: c.content,
              hitText: c.hitText,
            })),
          }),
        );
      }
      // 处理生成的图片附件
      if (result && result.generatedAttachments) {
        dispatch(
          updateLastMessageAttachments({
            conversationId: activeConversationId,
            attachments: result.generatedAttachments,
          }),
        );
      }
    } catch (error: unknown) {
      console.error("Failed to send message", error);
      const message = error instanceof Error ? error.message : undefined;
      hasError = true;
      assistantContent = `错误：${message || "发生未知错误"}`;
      // Show error in the chat
      dispatch(
        updateLastMessageContent({
          conversationId: activeConversationId,
          content: assistantContent,
        }),
      );
    } finally {
      dispatch(setStreaming(false));
      dispatch(finalizeLastMessage({ conversationId: activeConversationId }));
      void appendMessageRemote(activeConversationId, {
        id: uuidv4(),
        role: "assistant",
        content: assistantContent,
        createdAt: Date.now(),
        status: hasError ? "error" : "sent",
        citations: assistantCitations || undefined,
      });
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
      <div
        className="flex-1 overflow-y-auto"
        ref={scrollRef}
        onScroll={handleScroll}
      >
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
