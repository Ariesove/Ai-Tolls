import { Message } from '@/types/chat';

const MOCK_DELAY = 500;
const STREAM_DELAY = 50;

export const mockAiService = {
  async sendMessage(messages: Message[], onChunk: (chunk: string) => void): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));

    const lastMessage = messages[messages.length - 1];
    const mockResponse = `This is a mock response to: "${lastMessage.content}". \n\nI am simulating a streaming response to demonstrate the UI capabilities.`;

    const chunks = mockResponse.split('');

    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, STREAM_DELAY));
      onChunk(chunk);
    }
  }
};
