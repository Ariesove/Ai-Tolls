import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ragEngine as mockRAGEngine } from '@/services/rag/mockRAGEngine';
import { openAIRAGEngine } from '@/services/rag/openAIRAGEngine';
import { BookOpen, Check, X } from 'lucide-react';

interface KnowledgeBaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeBaseDialog: React.FC<KnowledgeBaseDialogProps> = ({ isOpen, onClose }) => {
  const [text, setText] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleIngest = async () => {
    if (!text.trim()) return;
    
    setIsIngesting(true);
    setError('');
    
    try {
      const apiKey = localStorage.getItem('OPENAI_API_KEY');
      
      if (apiKey) {
        // Use Real Engine
        await openAIRAGEngine.ingest(text, 'user-paste');
      } else {
        // Use Mock Engine
        await mockRAGEngine.ingest(text, 'user-paste');
      }
      
      setSuccess(true);
      setText('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to ingest text", err);
      setError(err.message || "Failed to add to knowledge base.");
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-zinc-100">Add to Knowledge Base</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-400">
          Paste any text below. 
          {localStorage.getItem('OPENAI_API_KEY') 
            ? " Uses OpenAI Embeddings (Real)." 
            : " Uses Mock Embeddings (Local Demo)."}
        </p>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste documentation, articles, or notes here..."
          className="min-h-[200px] mb-2 bg-zinc-950 border-zinc-800 focus:border-blue-500/50"
        />

        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleIngest} 
            disabled={!text.trim() || isIngesting || success}
            className={success ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isIngesting ? 'Indexing...' : success ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Added!
              </>
            ) : 'Add to Knowledge'}
          </Button>
        </div>
      </div>
    </div>
  );
};
