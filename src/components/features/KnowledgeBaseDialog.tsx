import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ragEngine as mockRAGEngine } from "@/services/rag/mockRAGEngine";
import { addText, search, StoredDocument } from "@/services/rag/RAG";
import { BookOpen, Check, X, Search } from "lucide-react";

interface KnowledgeBaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeBaseDialog: React.FC<KnowledgeBaseDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [text, setText] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Search Test State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { doc: StoredDocument; score?: number }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  if (!isOpen) return null;

  const handleIngest = async () => {
    if (!text.trim()) return;

    setIsIngesting(true);
    setError("");

    try {
      const apiKey =
        localStorage.getItem("OPENAI_API_KEY") ??
        "sk-4EVaiOOCO95SvVh78XPgajAnVNB7lKcpM2tuGIRFScudhMvC";

      if (apiKey) {
        // Use Real Engine (Functional RAG)
        await addText(text, { source: "user-paste" });
      } else {
        // Use Mock Engine
        await mockRAGEngine.ingest(text, "user-paste");
      }

      setSuccess(true);
      // setText("");
      setTimeout(() => {
        setSuccess(false);
        // Don't close immediately so user can test search
        // onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to ingest text", err);
      setError(err.message || "Failed to add to knowledge base.");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleSearchTest = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await search(searchQuery);
      // Note: RAG.ts search returns StoredDocument[], logs score to console.
      // To display score here we would need search to return it, but for now we show content.
      setSearchResults(results.map((doc) => ({ doc })));
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">
                Knowledge Base
              </h2>
              <p className="text-sm text-zinc-400">
                Add content for the AI to reference
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Ingest Section */}
          <div className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste text, documentation, or context here..."
              className="min-h-[150px] resize-none border-zinc-800 bg-zinc-900/50 text-zinc-100 focus:border-blue-500/50 focus:ring-blue-500/20"
            />

            {error && (
              <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleIngest}
                disabled={!text.trim() || isIngesting}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {isIngesting ? (
                  "Adding..."
                ) : success ? (
                  <span className="flex items-center gap-2">
                    <Check size={16} /> Added
                  </span>
                ) : (
                  "Add to Knowledge Base"
                )}
              </Button>
            </div>
          </div>

          <div className="h-px bg-zinc-800" />

          {/* Search Test Section (Phase 2) */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              Similarity Search Test
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a query to test retrieval..."
                className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
              />
              <Button
                onClick={handleSearchTest}
                disabled={isSearching || !searchQuery}
                variant="outline"
              >
                <Search size={16} className="mr-2" />
                {isSearching ? "Searching..." : "Test"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-4">
                <p className="mb-2 text-xs text-zinc-500">
                  Top Matches (Check Console for Scores)
                </p>
                <div className="space-y-2">
                  {searchResults.map((res, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-zinc-800/50 bg-zinc-950 p-2 text-sm text-zinc-300"
                    >
                      {res.doc.pageContent.slice(0, 100)}...
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
