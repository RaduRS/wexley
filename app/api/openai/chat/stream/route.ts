import OpenAI from 'openai';
import { NextRequest } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message, conversation = [] } = await request.json();

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    // Create the messages array for OpenAI
    const messages = [
      {
        role: 'system' as const,
        content: 'You are Wexly, a helpful AI musical companion. You provide concise, friendly responses about music, audio analysis, and creative suggestions. Keep responses brief and engaging.'
      },
      ...conversation,
      {
        role: 'user' as const,
        content: message
      }
    ];

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      max_tokens: 500,
      temperature: 0.7,
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const data = `data: ${JSON.stringify({ content })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          
          // Send completion signal
          const doneData = `data: ${JSON.stringify({ done: true })}\n\n`;
          controller.enqueue(encoder.encode(doneData));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    return Response.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}