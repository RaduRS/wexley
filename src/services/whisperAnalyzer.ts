export interface WhisperMusicAnalysis {
  instruments: string[];
  genre: string;
  tempo: string;
  key?: string;
  mood: string;
  description: string;
  isMusic: boolean;
  confidence: number;
}

export interface WhisperAnalysisResult {
  whisper: {
    text: string;
    language: string;
    duration: number;
    segments: Array<{
      id: number;
      seek: number;
      start: number;
      end: number;
      text: string;
      tokens: number[];
      temperature: number;
      avg_logprob: number;
      compression_ratio: number;
      no_speech_prob: number;
    }>;
  };
  music: WhisperMusicAnalysis;
}

export class WhisperAnalyzer {
  private static instance: WhisperAnalyzer;

  static getInstance(): WhisperAnalyzer {
    if (!WhisperAnalyzer.instance) {
      WhisperAnalyzer.instance = new WhisperAnalyzer();
    }
    return WhisperAnalyzer.instance;
  }

  async analyzeAudio(audioBuffer: ArrayBuffer): Promise<WhisperAnalysisResult | null> {
    try {
      // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
      const uint8Array = new Uint8Array(audioBuffer);
      let base64Audio = '';
      const chunkSize = 8192; // Process in 8KB chunks
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
      }

      const response = await fetch('/api/whisper/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Audio,
        }),
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error('Whisper analysis failed');
      }

      return result;
    } catch (error) {
      console.error('Error in Whisper analysis:', error);
      return null;
    }
  }

  // Helper method to determine if audio contains music vs speech
  static isMusicContent(analysis: WhisperAnalysisResult): boolean {
    if (!analysis?.music) return false;
    
    // Check if Whisper detected music with reasonable confidence
    return analysis.music.isMusic && analysis.music.confidence > 0.5;
  }

  // Helper method to format music analysis for chat
  static formatMusicAnalysis(analysis: WhisperMusicAnalysis): string {
    const parts = [];

    if (analysis.instruments && analysis.instruments.length > 0) {
      if (analysis.instruments.length === 1) {
        parts.push(`I hear ${analysis.instruments[0]} playing`);
      } else {
        const lastInstrument = analysis.instruments.pop();
        parts.push(`I hear ${analysis.instruments.join(', ')} and ${lastInstrument} playing`);
      }
    }

    if (analysis.genre && analysis.genre !== 'unknown') {
      parts.push(`in a ${analysis.genre} style`);
    }

    if (analysis.tempo) {
      parts.push(`at a ${analysis.tempo} tempo`);
    }

    if (analysis.mood) {
      parts.push(`with a ${analysis.mood} feel`);
    }

    if (analysis.key) {
      parts.push(`in the key of ${analysis.key}`);
    }

    let result = parts.join(' ');
    if (result) {
      result += '. ';
    }

    if (analysis.description) {
      result += analysis.description;
    }

    return result || 'I detected some musical content in your audio.';
  }
}

export const whisperAnalyzer = WhisperAnalyzer.getInstance();