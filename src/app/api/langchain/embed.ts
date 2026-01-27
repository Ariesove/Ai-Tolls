import { NextRequest, NextResponse } from 'next/server';
import { OpenAIEmbeddings } from '@langchain/openai';

export async function POST(request: NextRequest) {
  try {
    const { text, model = 'text-embedding-ada-002' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const embeddings = new OpenAIEmbeddings({
      model,
      openAIApiKey: process.env.AI_KEY,
      configuration: {
        baseURL: process.env.AI_BASE_URL,
      },
    });

    const embedding = await embeddings.embedQuery(text);

    return NextResponse.json({
      text,
      embedding,
      model,
      dimension: embedding.length,
      provider: 'langchain',
    });
  } catch (error) {
    console.error('Error generating embedding:', error);
    return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 });
  }
}