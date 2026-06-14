import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, Message, Conversation, MessageRole, ModelId, Attachment, Citation } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';
import * as chatApi from '@/services/api/chat';

export const hydrateConversations = createAsyncThunk<
  Conversation[],
  void,
  { rejectValue: string }
>('chat/hydrateConversations', async (_: void, { rejectWithValue }) => {
  const res = await chatApi.listConversations();
  if (!res.success) return rejectWithValue(res.error);
  return res.data;
});

export const createConversationRemote = createAsyncThunk<
  Conversation,
  void,
  { rejectValue: string }
>('chat/createConversationRemote', async (_: void, { rejectWithValue }) => {
  const now = Date.now();
  const input = {
    id: uuidv4(),
    title: 'New Chat',
    createdAt: now,
    updatedAt: now,
  };
  const res = await chatApi.createConversation(input);
  if (!res.success) {
    return {
      id: input.id,
      title: input.title,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      messages: [],
    };
  }
  return res.data;
});

export const deleteConversationRemote = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>('chat/deleteConversationRemote', async (id: string, { rejectWithValue }) => {
  const res = await chatApi.deleteConversation(id);
  if (!res.success) return rejectWithValue(res.error);
  return id;
});

export const loadMessagesRemote = createAsyncThunk<
  { conversationId: string; messages: Message[] },
  string,
  { rejectValue: string }
>('chat/loadMessagesRemote', async (conversationId: string, { rejectWithValue }) => {
  const res = await chatApi.listMessages(conversationId);
  if (!res.success) return rejectWithValue(res.error);
  return { conversationId, messages: res.data };
});

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
    setLastMessageCitations: (state, action: PayloadAction<{ conversationId: string; citations: Citation[] }>) => {
      const { conversationId, citations } = action.payload;
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation && conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        lastMessage.citations = citations;
      }
    },
    updateLastMessageAttachments: (state, action: PayloadAction<{ conversationId: string; attachments: Attachment[] }>) => {
      const { conversationId, attachments } = action.payload;
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation && conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        lastMessage.attachments = attachments;
      }
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
  extraReducers: (builder) => {
    builder.addCase(hydrateConversations.fulfilled, (state, action) => {
      state.conversations = action.payload;
      if (!state.activeConversationId) {
        state.activeConversationId = action.payload.length > 0 ? action.payload[0].id : null;
      } else if (!action.payload.some((c) => c.id === state.activeConversationId)) {
        state.activeConversationId = action.payload.length > 0 ? action.payload[0].id : null;
      }
    });

    builder.addCase(createConversationRemote.fulfilled, (state, action) => {
      state.conversations.unshift(action.payload);
      state.activeConversationId = action.payload.id;
    });

    builder.addCase(deleteConversationRemote.fulfilled, (state, action) => {
      state.conversations = state.conversations.filter(c => c.id !== action.payload);
      if (state.activeConversationId === action.payload) {
        state.activeConversationId = state.conversations.length > 0 ? state.conversations[0].id : null;
      }
    });

    builder.addCase(loadMessagesRemote.fulfilled, (state, action) => {
      const { conversationId, messages } = action.payload;
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation) {
        conversation.messages = messages;
        conversation.updatedAt = Date.now();
      }
    });
  }
});

export const {
  createConversation,
  setActiveConversation,
  setSelectedModel,
  addMessage,
  updateLastMessageContent,
  finalizeLastMessage,
  setStreaming,
  deleteConversation,
  setLastMessageCitations,
  updateLastMessageAttachments
} = chatSlice.actions;

export default chatSlice.reducer;
