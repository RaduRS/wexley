import { createClient } from '@deepgram/sdk';
import { NextRequest } from 'next/server';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { audio } = await request.json();
    
    if (!audio) {
      return Response.json({ error: 'Audio data is required' }, { status: 400 });
    }

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        diarize: false,
      }
    );

    if (error) {
      console.error('Deepgram error:', error);
      return Response.json({ error: 'Transcription failed' }, { status: 500 });
    }

    const transcript = result.results?.channels[0]?.alternatives[0]?.transcript || '';
    const confidence = result.results?.channels[0]?.alternatives[0]?.confidence || 0;
    
    return Response.json({ 
      transcript,
      confidence,
      isFinal: true
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}