import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSelectedModel } from '@/store/chatSlice';
import { AVAILABLE_MODELS, ModelId } from '@/types/chat';
import { ChevronDown, Box } from 'lucide-react';

export const ModelSelector: React.FC = () => {
  const dispatch = useAppDispatch();
  const { selectedModelId } = useAppSelector((state) => state.chat);
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (modelId: ModelId) => {
    dispatch(setSelectedModel(modelId));
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <span className="text-zinc-400">Model:</span>
        <span className="text-zinc-100">{selectedModel.name}</span>
        <ChevronDown className="h-4 w-4 text-zinc-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl p-1 z-50">
          {AVAILABLE_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => handleSelect(model.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                selectedModelId === model.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-950 border border-zinc-800">
                <Box className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-medium">{model.name}</span>
                <span className="text-xs text-zinc-500">{model.provider}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
