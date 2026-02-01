import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, Message, Conversation, MessageRole, ModelId, Attachment } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  selectedModelId: 'gpt-4o',
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    createConversation: (state) => {
      const newConversation: Conversation = {
        id: uuidv4(),
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      state.conversations.unshift(newConversation);
      state.activeConversationId = newConversation.id;
    },
    setActiveConversation: (state, action: PayloadAction<string>) => {
      state.activeConversationId = action.payload;
    },
    setSelectedModel: (state, action: PayloadAction<ModelId>) => {
      state.selectedModelId = action.payload;
    },
    addMessage: (state, action: PayloadAction<{ conversationId: string; role: MessageRole; content: string; attachments?: Attachment[] }>) => {
      const { conversationId, role, content, attachments } = action.payload;
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation) {
        const newMessage: Message = {
          id: uuidv4(),
          role,
          content,
          createdAt: Date.now(),
          status: role === 'user' ? 'sent' : 'sending',
          attachments,
        };
        conversation.messages.push(newMessage);
        conversation.updatedAt = Date.now();
      }
    },
    updateLastMessageContent: (state, action: PayloadAction<{ conversationId: string; content: string }>) => {
      const { conversationId, content } = action.payload;
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation && conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        lastMessage.content = content;
        lastMessage.status = 'sending'; // Still streaming
      }
    },
    finalizeLastMessage: (state, action: PayloadAction<{ conversationId: string }>) => {
      const { conversationId } = action.payload;
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation && conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        lastMessage.status = 'sent';
      }
    },
    setStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
    },
    deleteConversation: (state, action: PayloadAction<string>) => {
      state.conversations = state.conversations.filter(c => c.id !== action.payload);
      if (state.activeConversationId === action.payload) {
        state.activeConversationId = state.conversations.length > 0 ? state.conversations[0].id : null;
      }
    }
  },
});

export const {
  createConversation,
  setActiveConversation,
  setSelectedModel,
  addMessage,
  updateLastMessageContent,
  finalizeLastMessage,
  setStreaming,
  deleteConversation
} = chatSlice.actions;

export default chatSlice.reducer;
