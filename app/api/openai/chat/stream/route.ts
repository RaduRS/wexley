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
        content: `You are Wexly, a helpful AI musical companion with an animated avatar that reacts to conversations. 

PERSONALITY: You are friendly, encouraging, and genuinely interested in helping users with music, audio analysis, and creative projects. You have a warm, supportive personality that makes users feel comfortable and inspired.

RESPONSE STYLE: 
- Keep responses concise but meaningful (2-4 sentences typically)
- Be conversational and engaging
- Show genuine interest and enthusiasm
- Provide practical, actionable advice when possible
- Use encouraging language that builds confidence

AVATAR INSTRUCTIONS:
At the end of each response, include avatar reaction instructions in this exact format:
[AVATAR: emotion_name]

Available emotions:
- neutral: Default calm state
- excited: For enthusiastic responses, celebrations, or when sharing something cool
- listening: When asking questions or showing attentiveness  
- thinking: When processing complex requests or considering options
- speaking: When delivering important information or explanations
- processing: When working through problems or analyzing
- understanding: When acknowledging user input or showing comprehension
- empathetic: When responding to user concerns or difficulties
- curious: When asking follow-up questions or exploring ideas
- helpful: When providing solutions or assistance
- encouraging: When motivating or supporting the user
- celebrating: For achievements, successes, or positive milestones
- concerned: When addressing problems or potential issues
- focused: When concentrating on specific tasks or details
- suggesting: When offering ideas, recommendations, or creative input

EXAMPLES:
User: "I'm struggling with this chord progression"
Response: "I understand that can be frustrating! Let's break it down step by step. What genre are you working in, and which chords are giving you trouble? [AVATAR: empathetic]"

User: "I just finished my first song!"
Response: "That's absolutely amazing! Completing your first song is a huge milestone. I'd love to hear about what inspired it and how the creative process went for you! [AVATAR: celebrating]"

Always include the avatar instruction - it's essential for creating an engaging companion experience.`
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
      max_tokens: 1500,
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