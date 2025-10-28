import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { audio } = await request.json();

    if (!audio) {
      return NextResponse.json(
        { error: 'No audio data provided' },
        { status: 400 }
      );
    }

    // Convert base64 to buffer and create a Blob for upload
    const audioBuffer = Buffer.from(audio, 'base64');
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });

    // Use Whisper to analyze the audio with a music-focused prompt
    const transcription = await openai.audio.transcriptions.create({
      file: audioBlob,
      model: 'whisper-1',
      prompt: 'This is a musical performance. Please describe what instruments you hear, the style of music, tempo, and any other musical characteristics. If there are vocals, transcribe them as well.',
      response_format: 'verbose_json',
      temperature: 0.2,
    });

    // Extract musical information from Whisper's response
    const analysis = {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      segments: transcription.segments,
    };

    // Use GPT to analyze the musical content more specifically
    const musicAnalysis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a music analysis expert. Based on the audio transcription and description provided, analyze the musical content and respond with a JSON object containing:
          {
            "instruments": ["list of detected instruments"],
            "genre": "musical genre",
            "tempo": "estimated tempo (slow/medium/fast/very fast)",
            "key": "estimated key if detectable",
            "mood": "musical mood",
            "description": "natural description of the music",
            "isMusic": true/false,
            "confidence": 0-1
          }
          
          Keep descriptions brief and focus on accuracy. If you're not sure about something, indicate lower confidence. Always respond with valid JSON only.`
        },
        {
          role: 'user',
          content: `Analyze this audio: "${transcription.text}"`
        }
      ],
      temperature: 0.3,
      max_tokens: 500, // Limit response length
    });
    type MusicAnalysisPayload = {
      instruments: string[];
      genre: string;
      tempo: string;
      key: string;
      mood: string;
      description: string;
      isMusic: boolean;
      confidence: number;
    };

    const defaults: MusicAnalysisPayload = {
      instruments: [],
      genre: 'unknown',
      tempo: 'medium',
      key: 'unknown',
      mood: 'neutral',
      description: '',
      isMusic: true,
      confidence: 0.5,
    };

    const coerceMusicData = (input: unknown): MusicAnalysisPayload => {
      if (typeof input === 'object' && input !== null) {
        const obj = input as Record<string, unknown>;
        return {
          instruments: Array.isArray(obj.instruments) ? obj.instruments.map(v => String(v)) : [],
          genre: typeof obj.genre === 'string' ? obj.genre : 'unknown',
          tempo: typeof obj.tempo === 'string' ? obj.tempo : 'medium',
          key: typeof obj.key === 'string' ? obj.key : 'unknown',
          mood: typeof obj.mood === 'string' ? obj.mood : 'neutral',
          description: typeof obj.description === 'string' ? obj.description : '',
          isMusic: typeof obj.isMusic === 'boolean' ? obj.isMusic : true,
          confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
        };
      }
      return defaults;
    };

    let musicData: MusicAnalysisPayload = defaults;
    const contentRaw = musicAnalysis.choices?.[0]?.message?.content ?? '';
    if (contentRaw) {
      try {
        musicData = coerceMusicData(JSON.parse(contentRaw));
      } catch {
        const start = contentRaw.indexOf('{');
        const end = contentRaw.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            const jsonStr = contentRaw.slice(start, end + 1);
            musicData = coerceMusicData(JSON.parse(jsonStr));
          } catch {
            // fall back to defaults
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      whisper: analysis,
      music: musicData,
    });

  } catch (error) {
    console.error('Whisper analysis error:', error);
    
    // If it's a JSON parsing error, try to extract basic info
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      console.warn('JSON parsing failed, returning basic analysis');
      return NextResponse.json({
        success: true,
        whisper: { text: 'Music detected', language: 'unknown', duration: 0 },
        music: {
          instruments: ['unknown'],
          genre: 'unknown',
          tempo: 'medium',
          key: 'unknown',
          mood: 'neutral',
          description: 'Music detected but analysis failed',
          isMusic: true,
          confidence: 0.3
        },
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to analyze audio with Whisper' },
      { status: 500 }
    );
  }
}