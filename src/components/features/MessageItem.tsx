import React from "react";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Bot, User, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface MessageItemProps {
  message: Message;
  onRetry?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onRetry,
}) => {
  const isUser = message.role === "user";
  const isError = message.status === "error";

  return (
    <div
      className={cn(
        "flex w-full gap-4 p-4 md:px-8 transition-opacity",
        isUser ? "bg-zinc-950" : "bg-zinc-900/50",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm",
          isUser ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-100",
        )}
      >
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </div>

      <div className="flex-1 space-y-2 overflow-hidden">
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {message.attachments.map((att) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={att.id}
                src={att.url}
                alt={att.name}
                className="max-h-64 max-w-full rounded-lg border border-zinc-800 object-contain"
              />
            ))}
          </div>
        )}

        {/* Text Content */}
        {message.content && (
          <div className="prose prose-sm prose-invert max-w-none text-zinc-300 whitespace-pre-wrap">
            {message.content}
            {message.status === "sending" && (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-zinc-400 align-middle" />
            )}
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to send message.</span>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-auto p-0 text-red-400 hover:bg-transparent hover:text-red-300 hover:underline"
              >
                <RefreshCw className="mr-1 h-3 w-3" /> Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
