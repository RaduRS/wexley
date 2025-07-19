import { AudioFeatures } from '@/types/audio';

export interface VoiceAnalysis {
  isVoiceDetected: boolean;
  isSinging: boolean; // vs talking
  confidence: number;
  pitch: number;
  pitchStability: number; // how stable the pitch is (singing vs talking)
  vocalRange: { min: number; max: number };
  inKey: boolean; // is the voice in key with the music?
  harmony: 'consonant' | 'dissonant' | 'neutral';
}

export interface InstrumentAnalysis {
  instruments: string[];
  confidence: number;
  chords: string[];
  chordProgression: string[];
  key: string;
  tempo: number;
  timeSignature: string;
  musicalStructure: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'unknown';
}

export interface MusicCompanionAnalysis {
  voice: VoiceAnalysis;
  instruments: InstrumentAnalysis;
  overall: {
    musicType: 'instrumental' | 'vocal' | 'mixed';
    quality: 'excellent' | 'good' | 'needs_work';
    suggestions: string[];
  };
}

export class MusicCompanion {
  private pitchHistory: number[] = [];
  private chordHistory: string[] = [];
  private readonly maxHistoryLength = 50;

  /**
   * Analyzes audio to separate voice from instruments and provide musical feedback
   */
  analyzePerformance(
    audioData: Float32Array,
    features: AudioFeatures,
    sampleRate: number = 44100
  ): MusicCompanionAnalysis {
    const voice = this.analyzeVoice(audioData, features, sampleRate);
    const instruments = this.analyzeInstruments(features);
    const overall = this.analyzeOverall(voice, instruments);

    return { voice, instruments, overall };
  }

  /**
   * Detects and analyzes voice characteristics
   */
  private analyzeVoice(
    audioData: Float32Array,
    features: AudioFeatures,
    sampleRate: number
  ): VoiceAnalysis {
    const spectralCentroid = features.spectralCentroid || 0;
    const zcr = features.zcr || 0;
    const rms = features.rms || 0;
    const mfcc = features.mfcc || [];

    // Voice detection heuristics
    const isVoiceDetected = this.detectVoice(spectralCentroid, zcr, rms, mfcc);
    
    if (!isVoiceDetected) {
      return {
        isVoiceDetected: false,
        isSinging: false,
        confidence: 0,
        pitch: 0,
        pitchStability: 0,
        vocalRange: { min: 0, max: 0 },
        inKey: false,
        harmony: 'neutral'
      };
    }

    // Pitch analysis for singing detection
    const pitch = this.extractPitch(audioData, sampleRate);
    this.pitchHistory.push(pitch);
    if (this.pitchHistory.length > this.maxHistoryLength) {
      this.pitchHistory.shift();
    }

    const pitchStability = this.calculatePitchStability();
    const isSinging = this.detectSinging(pitchStability, zcr);
    const vocalRange = this.calculateVocalRange();
    const inKey = this.isVoiceInKey(pitch, features.chroma || []);
    const harmony = this.analyzeHarmony(pitch, features.chroma || []);

    return {
      isVoiceDetected: true,
      isSinging,
      confidence: this.calculateVoiceConfidence(spectralCentroid, zcr, rms),
      pitch,
      pitchStability,
      vocalRange,
      inKey,
      harmony
    };
  }

  /**
   * Analyzes instrumental content
   */
  private analyzeInstruments(features: AudioFeatures): InstrumentAnalysis {
    const chroma = features.chroma || [];
    const spectralCentroid = features.spectralCentroid || 0;
    const spectralRolloff = features.spectralRolloff || 0;
    const rms = features.rms || 0;

    const instruments = this.detectInstruments(spectralCentroid, spectralRolloff, rms);
    const chords = this.detectChords(chroma);
    const key = this.detectKey(chroma);
    const tempo = this.estimateTempo(features);
    
    // Add to chord history for progression analysis
    if (chords.length > 0) {
      this.chordHistory.push(chords[0]);
      if (this.chordHistory.length > this.maxHistoryLength) {
        this.chordHistory.shift();
      }
    }

    const chordProgression = this.analyzeChordProgression();
    const timeSignature = this.detectTimeSignature();
    const musicalStructure = this.detectMusicalStructure();

    return {
      instruments,
      confidence: 0.8, // TODO: Calculate based on detection confidence
      chords,
      chordProgression,
      key,
      tempo,
      timeSignature,
      musicalStructure
    };
  }

  /**
   * Provides overall analysis and suggestions
   */
  private analyzeOverall(
    voice: VoiceAnalysis,
    instruments: InstrumentAnalysis
  ): MusicCompanionAnalysis['overall'] {
    let musicType: 'instrumental' | 'vocal' | 'mixed';
    
    if (voice.isVoiceDetected && instruments.instruments.length > 0) {
      musicType = 'mixed';
    } else if (voice.isVoiceDetected) {
      musicType = 'vocal';
    } else {
      musicType = 'instrumental';
    }

    const quality = this.assessQuality(voice, instruments);
    const suggestions = this.generateSuggestions(voice, instruments);

    return { musicType, quality, suggestions };
  }

  // Voice Detection Methods
  private detectVoice(
    spectralCentroid: number,
    zcr: number,
    rms: number,
    mfcc: number[]
  ): boolean {
    // Voice typically has:
    // - Spectral centroid in vocal range (80-1000 Hz for fundamental, harmonics up to 4kHz)
    // - Moderate zero crossing rate
    // - Sufficient energy
    // - Specific MFCC characteristics

    const hasVocalSpectralRange = spectralCentroid > 200 && spectralCentroid < 4000;
    const hasVocalZCR = zcr > 0.02 && zcr < 0.3;
    const hasSufficientEnergy = rms > 0.01;
    const hasVocalMFCC = mfcc.length > 0 && mfcc[0] > -20; // First MFCC coefficient

    return hasVocalSpectralRange && hasVocalZCR && hasSufficientEnergy && hasVocalMFCC;
  }

  private extractPitch(audioData: Float32Array, sampleRate: number): number {
    // Simple autocorrelation-based pitch detection
    const minPeriod = Math.floor(sampleRate / 800); // 800 Hz max
    const maxPeriod = Math.floor(sampleRate / 80);  // 80 Hz min
    
    let bestPeriod = 0;
    let bestCorrelation = 0;

    for (let period = minPeriod; period < maxPeriod && period < audioData.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < audioData.length - period; i++) {
        correlation += audioData[i] * audioData[i + period];
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  }

  private calculatePitchStability(): number {
    if (this.pitchHistory.length < 5) return 0;
    
    const recentPitches = this.pitchHistory.slice(-10);
    const mean = recentPitches.reduce((a, b) => a + b, 0) / recentPitches.length;
    const variance = recentPitches.reduce((acc, pitch) => acc + Math.pow(pitch - mean, 2), 0) / recentPitches.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation = more stable = more likely singing
    return Math.max(0, 1 - (standardDeviation / mean));
  }

  private detectSinging(pitchStability: number, zcr: number): boolean {
    // Singing typically has:
    // - More stable pitch than talking
    // - Lower zero crossing rate than talking
    return pitchStability > 0.7 && zcr < 0.15;
  }

  private calculateVocalRange(): { min: number; max: number } {
    if (this.pitchHistory.length === 0) return { min: 0, max: 0 };
    
    const validPitches = this.pitchHistory.filter(p => p > 0);
    return {
      min: Math.min(...validPitches),
      max: Math.max(...validPitches)
    };
  }

  private isVoiceInKey(pitch: number, chroma: number[]): boolean {
    if (pitch === 0 || chroma.length !== 12) return false;
    
    // Convert pitch to note (simplified)
    const noteIndex = Math.round(12 * Math.log2(pitch / 440)) % 12;
    const normalizedIndex = (noteIndex + 9) % 12; // A=0 to C=0
    
    // Check if the note is strong in the chroma vector
    return chroma[normalizedIndex] > 0.3;
  }

  private analyzeHarmony(pitch: number, chroma: number[]): 'consonant' | 'dissonant' | 'neutral' {
    if (pitch === 0 || chroma.length !== 12) return 'neutral';
    
    // Simplified harmony analysis
    const noteIndex = Math.round(12 * Math.log2(pitch / 440)) % 12;
    const normalizedIndex = (noteIndex + 9) % 12;
    
    // Check for consonant intervals (perfect 5th, major 3rd, etc.)
    const consonantIntervals = [0, 4, 7]; // Root, major third, perfect fifth
    const hasConsonance = consonantIntervals.some(interval => 
      chroma[(normalizedIndex + interval) % 12] > 0.3
    );
    
    return hasConsonance ? 'consonant' : 'dissonant';
  }

  private calculateVoiceConfidence(
    spectralCentroid: number,
    zcr: number,
    rms: number
  ): number {
    let confidence = 0;
    
    // Spectral centroid in vocal range
    if (spectralCentroid > 200 && spectralCentroid < 4000) confidence += 0.4;
    
    // Appropriate zero crossing rate
    if (zcr > 0.02 && zcr < 0.3) confidence += 0.3;
    
    // Sufficient energy
    if (rms > 0.01) confidence += 0.3;
    
    return Math.min(1, confidence);
  }

  // Instrument Detection Methods
  private detectInstruments(
    spectralCentroid: number,
    spectralRolloff: number,
    rms: number
  ): string[] {
    const instruments: string[] = [];
    
    // Guitar detection
    if (spectralCentroid > 800 && spectralCentroid < 3000 && rms > 0.02) {
      instruments.push('guitar');
    }
    
    // Piano detection
    if (spectralCentroid > 500 && spectralCentroid < 4000 && spectralRolloff > 2000) {
      instruments.push('piano');
    }
    
    // Drums detection (high frequency content)
    if (spectralRolloff > 8000 && rms > 0.1) {
      instruments.push('drums');
    }
    
    return instruments.length > 0 ? instruments : ['unknown'];
  }

  private detectChords(chroma: number[]): string[] {
    if (chroma.length !== 12) return [];
    
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const threshold = 0.3;
    
    // Find the strongest note as potential root
    let maxChroma = 0;
    let rootIndex = 0;
    
    for (let i = 0; i < 12; i++) {
      if (chroma[i] > maxChroma) {
        maxChroma = chroma[i];
        rootIndex = i;
      }
    }
    
    if (maxChroma < threshold) return [];
    
    // Check for major triad (root, major third, perfect fifth)
    const majorThird = (rootIndex + 4) % 12;
    const perfectFifth = (rootIndex + 7) % 12;
    
    if (chroma[majorThird] > threshold && chroma[perfectFifth] > threshold) {
      return [notes[rootIndex] + 'maj'];
    }
    
    // Check for minor triad (root, minor third, perfect fifth)
    const minorThird = (rootIndex + 3) % 12;
    
    if (chroma[minorThird] > threshold && chroma[perfectFifth] > threshold) {
      return [notes[rootIndex] + 'min'];
    }
    
    return [notes[rootIndex]];
  }

  private detectKey(chroma: number[]): string {
    if (chroma.length !== 12) return 'C';
    
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Find the note with highest chroma value
    let maxChroma = 0;
    let keyIndex = 0;
    
    for (let i = 0; i < 12; i++) {
      if (chroma[i] > maxChroma) {
        maxChroma = chroma[i];
        keyIndex = i;
      }
    }
    
    return notes[keyIndex];
  }

  private estimateTempo(features: AudioFeatures): number {
    // Simplified tempo estimation - in production, use onset detection
    // For now, return a reasonable default
    return 120;
  }

  private analyzeChordProgression(): string[] {
    if (this.chordHistory.length < 4) return [];
    
    // Return the last 4 chords as a progression
    return this.chordHistory.slice(-4);
  }

  private detectTimeSignature(): string {
    // Simplified - return common time signature
    return '4/4';
  }

  private detectMusicalStructure(): 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'unknown' {
    // Simplified structure detection
    return 'unknown';
  }

  private assessQuality(
    voice: VoiceAnalysis,
    instruments: InstrumentAnalysis
  ): 'excellent' | 'good' | 'needs_work' {
    let score = 0;
    
    if (voice.isVoiceDetected) {
      if (voice.inKey) score += 2;
      if (voice.harmony === 'consonant') score += 2;
      if (voice.pitchStability > 0.7) score += 1;
    }
    
    if (instruments.chords.length > 0) score += 1;
    if (instruments.key !== 'C') score += 1; // Detected a specific key
    
    if (score >= 5) return 'excellent';
    if (score >= 3) return 'good';
    return 'needs_work';
  }

  private generateSuggestions(
    voice: VoiceAnalysis,
    instruments: InstrumentAnalysis
  ): string[] {
    const suggestions: string[] = [];
    
    if (voice.isVoiceDetected) {
      if (!voice.inKey) {
        suggestions.push(`Try singing in the key of ${instruments.key}`);
      }
      
      if (voice.harmony === 'dissonant') {
        suggestions.push('Your voice is creating some dissonance - try adjusting your pitch');
      }
      
      if (voice.pitchStability < 0.5) {
        suggestions.push('Work on pitch stability for better singing');
      }
    }
    
    if (instruments.chordProgression.length > 2) {
      const lastChord = instruments.chordProgression[instruments.chordProgression.length - 1];
      if (lastChord && !lastChord.includes(instruments.key)) {
        suggestions.push(`Try resolving to ${instruments.key} for a stronger ending`);
      }
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Sounds great! Keep it up!');
    }
    
    return suggestions;
  }

  /**
   * Formats the analysis for AI consumption
   */
  formatForAI(analysis: MusicCompanionAnalysis): string {
    const { voice, instruments, overall } = analysis;
    
    let description = `Musical Analysis:\n`;
    
    // Overall type
    description += `Type: ${overall.musicType}\n`;
    
    // Voice analysis
    if (voice.isVoiceDetected) {
      description += `Voice: ${voice.isSinging ? 'Singing' : 'Speaking'} `;
      description += `(pitch: ${voice.pitch.toFixed(1)}Hz, `;
      description += `stability: ${(voice.pitchStability * 100).toFixed(0)}%, `;
      description += `${voice.inKey ? 'in key' : 'off key'}, `;
      description += `harmony: ${voice.harmony})\n`;
    }
    
    // Instrument analysis
    if (instruments.instruments.length > 0) {
      description += `Instruments: ${instruments.instruments.join(', ')}\n`;
      description += `Key: ${instruments.key}, Tempo: ${instruments.tempo} BPM\n`;
      
      if (instruments.chords.length > 0) {
        description += `Current chords: ${instruments.chords.join(', ')}\n`;
      }
      
      if (instruments.chordProgression.length > 0) {
        description += `Chord progression: ${instruments.chordProgression.join(' - ')}\n`;
      }
    }
    
    // Quality and suggestions
    description += `Quality: ${overall.quality}\n`;
    description += `Suggestions: ${overall.suggestions.join('; ')}\n`;
    
    return description;
  }
}

// Export singleton instance
export const musicCompanion = new MusicCompanion();