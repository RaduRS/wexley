import { MusicAnalysis } from '@/utils/musicAnalyzer';
import { WhisperMusicAnalysis } from './whisperAnalyzer';

export interface MusicSuggestion {
  type: 'drums' | 'bass' | 'harmony' | 'melody' | 'arrangement' | 'production';
  instrument: string;
  style: string;
  description: string;
  reasoning: string;
}

export interface CreativeResponse {
  suggestions: MusicSuggestion[];
  overall_feedback: string;
  next_steps: string[];
  collaboration_mode: 'enhance' | 'create' | 'experiment' | 'refine';
}

export interface MusicCompanionContext {
  tempo: number;
  key: string;
  genre: string;
  mood: string;
  instruments: string[];
  confidence: number;
  isLive: boolean;
}

export class MusicCompanion {
  private static instance: MusicCompanion;

  static getInstance(): MusicCompanion {
    if (!MusicCompanion.instance) {
      MusicCompanion.instance = new MusicCompanion();
    }
    return MusicCompanion.instance;
  }

  /**
   * Generate creative companion prompts based on music analysis
   */
  generateCreativePrompt(context: MusicCompanionContext, mode: 'enhance' | 'create' | 'experiment' = 'enhance'): string {
    const { tempo, key, genre, mood, instruments, isLive } = context;

    switch (mode) {
      case 'enhance':
        return this.generateEnhancementPrompt(context);
      case 'create':
        return this.generateCreationPrompt(context);
      case 'experiment':
        return this.generateExperimentPrompt(context);
      default:
        return this.generateEnhancementPrompt(context);
    }
  }

  /**
   * Prompt 1: The Creative Collaborator - for enhancing existing music
   */
  private generateEnhancementPrompt(context: MusicCompanionContext): string {
    const { tempo, key, genre, mood, instruments, isLive } = context;
    
    const liveContext = isLive ? "I'm playing live" : "I'm working on a track";
    const instrumentList = instruments.length > 0 ? instruments.join(', ') : 'various instruments';

    return `You are my musical partner. ${liveContext} in ${key} at ${tempo} BPM (${genre}, ${mood} mood) with ${instrumentList}.

Give me ONE specific, actionable suggestion to enhance this right now. Keep it brief and focused.

Format as JSON:
{
  "suggestions": [
    {
      "type": "harmony|melody|rhythm",
      "instrument": "instrument name",
      "style": "technique",
      "description": "what to do",
      "reasoning": "why it helps"
    }
  ],
  "overall_feedback": "brief thoughts",
  "next_steps": ["one action"],
  "collaboration_mode": "enhance"
}

Be concise and actionable!`;
  }

  /**
   * Prompt 2: The Genre-Aware Expert - for style-specific suggestions
   */
  private generateCreationPrompt(context: MusicCompanionContext): string {
    const { tempo, key, genre, mood, instruments } = context;

    return `You are a ${genre} music producer. I'm building a track: ${tempo} BPM, ${key} key, ${mood} mood.

Give me ONE essential element to add next for authentic ${genre} sound.

JSON format:
{
  "suggestions": [
    {
      "type": "drums|bass|harmony",
      "instrument": "instrument",
      "style": "${genre} technique",
      "description": "brief guide",
      "reasoning": "why it fits ${genre}"
    }
  ],
  "overall_feedback": "brief assessment",
  "next_steps": ["one step"],
  "collaboration_mode": "create"
}

Keep it focused and genre-authentic.`;
  }

  /**
   * Prompt 3: The Interactive Auditioner - for specific part suggestions
   */
  private generateExperimentPrompt(context: MusicCompanionContext): string {
    const { tempo, key, genre, mood } = context;

    return `Virtual bandmate here! We're jamming in ${key} at ${tempo} BPM with ${mood} ${genre} vibes.

Give me ONE bold experimental idea to try right now:

{
  "suggestions": [
    {
      "type": "experiment",
      "instrument": "element",
      "style": "approach",
      "description": "what to try",
      "reasoning": "why it's interesting"
    }
  ],
  "overall_feedback": "jam thoughts",
  "next_steps": ["try this"],
  "collaboration_mode": "experiment"
}

Be bold but brief!`;
  }

  /**
   * Convert music analysis to companion context
   */
  createContextFromAnalysis(analysis: MusicAnalysis | WhisperMusicAnalysis, isLive: boolean = true): MusicCompanionContext {
    // Handle both analysis types
    if ('tempo' in analysis && typeof analysis.tempo === 'string') {
      // WhisperMusicAnalysis
      const whisperAnalysis = analysis as WhisperMusicAnalysis;
      return {
        tempo: this.parseTempoFromString(whisperAnalysis.tempo),
        key: whisperAnalysis.key || 'C',
        genre: whisperAnalysis.genre || 'unknown',
        mood: whisperAnalysis.mood || 'neutral',
        instruments: whisperAnalysis.instruments || [],
        confidence: whisperAnalysis.confidence || 0.5,
        isLive
      };
    } else {
      // MusicAnalysis
      const musicAnalysis = analysis as MusicAnalysis;
      return {
        tempo: musicAnalysis.tempo || 120,
        key: musicAnalysis.key || 'C',
        genre: musicAnalysis.genre || 'unknown',
        mood: musicAnalysis.mood || 'neutral',
        instruments: musicAnalysis.instruments || [],
        confidence: musicAnalysis.confidence || 0.5,
        isLive
      };
    }
  }

  /**
   * Generate context-aware prompt based on what's detected
   */
  generateContextualPrompt(analysis: MusicAnalysis | WhisperMusicAnalysis, isLive: boolean = true): string {
    const context = this.createContextFromAnalysis(analysis, isLive);
    
    // Determine the best mode based on context
    let mode: 'enhance' | 'create' | 'experiment' = 'enhance';
    
    if (context.instruments.length === 0 || context.confidence < 0.3) {
      mode = 'create';
    } else if (context.genre === 'unknown' || context.mood === 'neutral') {
      mode = 'experiment';
    }

    return this.generateCreativePrompt(context, mode);
  }

  /**
   * Generate a simple, direct prompt for quick interactions
   */
  generateQuickPrompt(context: MusicCompanionContext): string {
    const { tempo, key, genre, instruments, isLive } = context;
    
    const action = isLive ? "I'm playing" : "I'm working on";
    const instrumentText = instruments.length > 0 ? ` with ${instruments.join(' and ')}` : '';
    
    return `${action} ${genre} music in ${key} at ${tempo} BPM${instrumentText}. As my music partner, give me one specific suggestion to make this better right now. Be direct and actionable.`;
  }

  /**
   * Generate a very simple prompt that won't cause long responses
   */
  generateSimplePrompt(isLive: boolean = true): string {
    const action = isLive ? "I'm playing" : "I'm working on";
    return `${action} music right now. Give me one brief musical suggestion to improve what I'm doing. Keep it short and actionable.`;
  }

  /**
   * Helper to parse tempo from string descriptions
   */
  private parseTempoFromString(tempoStr: string): number {
    const tempoMap: { [key: string]: number } = {
      'very slow': 60,
      'slow': 80,
      'moderate': 100,
      'medium': 120,
      'fast': 140,
      'very fast': 160,
      'extremely fast': 180
    };

    const lowerTempo = tempoStr.toLowerCase();
    
    // Try to extract number first
    const numberMatch = tempoStr.match(/(\d+)/);
    if (numberMatch) {
      return parseInt(numberMatch[1]);
    }

    // Fall back to descriptive mapping
    for (const [desc, bpm] of Object.entries(tempoMap)) {
      if (lowerTempo.includes(desc)) {
        return bpm;
      }
    }

    return 120; // Default
  }

  /**
   * Format the AI response for display in the chat
   */
  formatResponseForChat(response: string): string {
    try {
      const parsed = JSON.parse(response) as CreativeResponse;
      
      let formatted = `🎵 **Creative Suggestions:**\n\n`;
      
      parsed.suggestions.forEach((suggestion, index) => {
        formatted += `**${index + 1}. ${suggestion.instrument} (${suggestion.type})**\n`;
        formatted += `Style: ${suggestion.style}\n`;
        formatted += `${suggestion.description}\n`;
        formatted += `💡 *${suggestion.reasoning}*\n\n`;
      });

      if (parsed.overall_feedback) {
        formatted += `**Overall:** ${parsed.overall_feedback}\n\n`;
      }

      if (parsed.next_steps && parsed.next_steps.length > 0) {
        formatted += `**Next Steps:**\n`;
        parsed.next_steps.forEach((step, index) => {
          formatted += `${index + 1}. ${step}\n`;
        });
      }

      return formatted;
    } catch (error) {
      // If JSON parsing fails, return the raw response
      return response;
    }
  }
}

export const musicCompanion = MusicCompanion.getInstance();