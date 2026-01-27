import { NextRequest, NextResponse } from 'next/server';
import { OpenAIEmbedding } from 'llamaindex';

export async function POST(request: NextRequest) {
  try {
    const { text, model = 'text-embedding-ada-002' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const embeddingModel = new OpenAIEmbedding({
      model,
      apiKey: process.env.AI_KEY,
      baseURL: process.env.AI_BASE_URL,
    });

    const embedding = await embeddingModel.getQueryEmbedding(text);

    return NextResponse.json({
      text,
      embedding,
      model,
      dimension: embedding.length,
      provider: 'llamaindex',
    });
  } catch (error) {
    console.error('Error generating embedding:', error);
    return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 });
  }
}