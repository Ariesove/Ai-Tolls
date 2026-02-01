export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'error';

export type ModelId = 'gpt-4o' | 'claude-3-5-sonnet' | 'llama-3-local';

export interface Model {
  id: ModelId;
  name: string;
  provider: string;
}

export interface Attachment {
  id: string;
  type: 'image';
  url: string;
  name: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  status?: MessageStatus;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  selectedModelId: ModelId;
}

export const AVAILABLE_MODELS: Model[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'llama-3-local', name: 'Llama 3 (Local)', provider: 'Ollama' },
];
