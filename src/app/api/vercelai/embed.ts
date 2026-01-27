import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from 'ai';

export async function POST(request: NextRequest) {
  try {
    const { text, model = 'text-embedding-ada-002' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const openai = createOpenAI({
      apiKey: process.env.AI_KEY,
      baseURL: process.env.AI_BASE_URL,
    });

    const response = await openai.embeddings.create({
      model,
      input: text,
    });

    const embedding = response.data[0].embedding;

    return NextResponse.json({
      text,
      embedding,
      model,
      dimension: embedding.length,
      provider: 'vercel-ai',
    });
  } catch (error) {
    console.error('Error generating embedding:', error);
    return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 });
  }
}