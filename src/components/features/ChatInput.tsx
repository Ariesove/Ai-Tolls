import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Send, Square, Image as ImageIcon, X } from 'lucide-react';
import { Attachment } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

interface ChatInputProps {
  onSend: (content: string, attachments?: Attachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, onStop, isStreaming, disabled }) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if ((!content.trim() && attachments.length === 0) || disabled || isStreaming) return;
    onSend(content, attachments.length > 0 ? attachments : undefined);
    setContent('');
    setAttachments([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      
      const newAttachment: Attachment = {
        id: uuidv4(),
        type: 'image',
        url,
        name: file.name
      };
      
      setAttachments(prev => [...prev, newAttachment]);
      
      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div className="relative flex w-full flex-col rounded-xl border border-zinc-700 bg-zinc-800 p-3 shadow-lg ring-offset-zinc-900 focus-within:ring-2 focus-within:ring-blue-500/50">
        
        {/* Attachment Preview */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
            {attachments.map((att) => (
              <div key={att.id} className="relative group shrink-0">
                <img 
                  src={att.url} 
                  alt={att.name} 
                  className="h-16 w-16 object-cover rounded-md border border-zinc-600"
                />
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1 -right-1 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message AI..."
          className="min-h-[40px] w-full resize-none border-0 bg-transparent p-0 text-zinc-100 placeholder:text-zinc-500 focus:ring-0 focus-visible:ring-0"
          disabled={disabled || isStreaming}
        />
        
        <div className="flex justify-between items-center mt-2">
           <div className="flex gap-2 text-zinc-400">
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleFileSelect}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-zinc-700 hover:text-zinc-200"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
              >
                 <ImageIcon className="h-4 w-4" />
              </Button>
           </div>

           <div>
              {isStreaming ? (
                <Button 
                  onClick={onStop}
                  variant="secondary" 
                  size="sm"
                  className="rounded-lg bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                >
                  <Square className="mr-1 h-3 w-3 fill-current" /> Stop
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit}
                  disabled={(!content.trim() && attachments.length === 0) || disabled}
                  size="sm"
                  className="rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white disabled:bg-zinc-600 disabled:text-zinc-400"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
           </div>
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-zinc-500">
        AI can make mistakes. Consider checking important information.
      </div>
    </div>
  );
};
