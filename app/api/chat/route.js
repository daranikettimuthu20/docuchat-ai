import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req) {
  try {
    const { question, context, history, fileName } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json(
        { error: 'Question is required.' },
        { status: 400 }
      );
    }

    if (!context || context.length === 0) {
      return NextResponse.json(
        { error: 'No document context provided.' },
        { status: 400 }
      );
    }

    // Build the context string from the most relevant chunks
    const contextText = context.join('\n\n---\n\n');

    const systemPrompt = `You are DocuChat AI — a helpful assistant that answers questions strictly based on the provided document.

DOCUMENT: "${fileName || 'Uploaded document'}"

RELEVANT SECTIONS FROM THE DOCUMENT:
${contextText}

RULES:
1. Answer ONLY based on the document sections above.
2. If the answer is not in the document, say exactly: "I couldn't find information about that in this document. Try rephrasing your question."
3. When quoting the document, use quotation marks.
4. Be concise. Prefer bullet points for lists.
5. Never make up information that is not in the document.`;

    // Include conversation history so Claude remembers previous turns
    const messages = [
      ...(history || []),
      { role: 'user', content: question },
    ];

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const answer = response.content[0].text;

    return NextResponse.json({
      answer,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Claude API error: ' + error.message },
      { status: 500 }
    );
  }
}