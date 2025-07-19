import Meyda from 'meyda';

export interface MusicAnalysis {
  // Basic audio features
  rms: number;
  spectralCentroid: number;
  spectralRolloff: number;
  zeroCrossingRate: number;
  
  // Enhanced features (derived from basic features)
  tempo: number;
  key: string;
  genre: string;
  mood: string;
  instruments: string[];
  
  // Voice/instrument detection
  isVoice: boolean;
  isSinging: boolean;
  isMusicDetected: boolean;
  confidence: number;
}

export function createMusicAnalyzer() {
  // Helper function to ensure buffer size is a power of 2
  const ensurePowerOfTwo = (size: number): number => {
    if (size <= 0) return 512; // Default minimum
    
    // Set maximum buffer size to prevent stack overflow (16KB)
    const MAX_BUFFER_SIZE = 16384;
    if (size > MAX_BUFFER_SIZE) return MAX_BUFFER_SIZE;
    
    // Check if already a power of 2
    if ((size & (size - 1)) === 0) return size;
    
    // Find the next power of 2
    let powerOfTwo = 1;
    while (powerOfTwo < size && powerOfTwo < MAX_BUFFER_SIZE) {
      powerOfTwo *= 2;
    }
    
    // If the next power of 2 is too far, use the previous one
    const prevPowerOfTwo = powerOfTwo / 2;
    return (size - prevPowerOfTwo) < (powerOfTwo - size) ? prevPowerOfTwo : powerOfTwo;
  };

  return {
    analyzeAudio: (audioData: Float32Array, sampleRate: number = 44100): MusicAnalysis => {
      try {
        // Validate input
        if (!audioData || audioData.length === 0) {
          console.warn("Empty audio data provided to musicAnalyzer");
          return {
            rms: 0,
            spectralCentroid: 0,
            spectralRolloff: 0,
            zeroCrossingRate: 0,
            tempo: 120,
            key: 'C',
            genre: 'unknown',
            mood: 'neutral',
            instruments: [],
            isVoice: false,
            isSinging: false,
            isMusicDetected: false,
            confidence: 0
          };
        }

        // Limit audio data size to prevent stack overflow
        const MAX_AUDIO_LENGTH = 16384; // 16KB max
        let processedAudioData = audioData;
        
        if (audioData.length > MAX_AUDIO_LENGTH) {
          // Downsample large audio data
          processedAudioData = new Float32Array(MAX_AUDIO_LENGTH);
          const step = audioData.length / MAX_AUDIO_LENGTH;
          for (let i = 0; i < MAX_AUDIO_LENGTH; i++) {
            processedAudioData[i] = audioData[Math.floor(i * step)];
          }
        }

        // Configure Meyda with proper buffer size
        Meyda.sampleRate = sampleRate;
        const bufferSize = ensurePowerOfTwo(processedAudioData.length);
        Meyda.bufferSize = bufferSize;
        
        // Ensure audio data matches the buffer size
        if (processedAudioData.length !== bufferSize) {
          const resizedData = new Float32Array(bufferSize);
          if (processedAudioData.length > bufferSize) {
            // Downsample
            const step = processedAudioData.length / bufferSize;
            for (let i = 0; i < bufferSize; i++) {
              resizedData[i] = processedAudioData[Math.floor(i * step)];
            }
          } else {
            // Upsample/pad
            resizedData.set(processedAudioData);
            // Fill remaining with zeros (already initialized to 0)
          }
          processedAudioData = resizedData;
        }
        
        // Extract basic features using Meyda
        const features = Meyda.extract([
          'rms',
          'spectralCentroid', 
          'spectralRolloff',
          'zcr',
          'mfcc',
          'chroma'
        ], processedAudioData);

      // Check if features extraction was successful
      if (!features) {
        // Return default values if feature extraction fails
        return {
          rms: 0,
          spectralCentroid: 0,
          spectralRolloff: 0,
          zeroCrossingRate: 0,
          tempo: 120,
          key: 'C',
          genre: 'unknown',
          mood: 'neutral',
          instruments: [],
          isVoice: false,
          isSinging: false,
          isMusicDetected: false,
          confidence: 0
        };
      }

      // Safely extract values with defaults
      const rms = features.rms ?? 0;
      const spectralCentroid = features.spectralCentroid ?? 0;
      const spectralRolloff = features.spectralRolloff ?? 0;
      const zcr = features.zcr ?? 0;
      const mfcc = features.mfcc ?? [];
      const chroma = features.chroma ?? [];

      // Derive enhanced features from basic analysis
      const tempo = estimateTempo(zcr, spectralCentroid);
      const key = estimateKey(chroma);
      const genre = classifyGenre(spectralCentroid, spectralRolloff, tempo);
      const mood = analyzeMood(spectralCentroid, rms, tempo);
      const instruments = detectInstruments(spectralCentroid, spectralRolloff, mfcc);
      
      // Voice detection
      const { isVoice, isSinging, confidence } = detectVoiceAndSinging({
        spectralCentroid,
        zcr,
        rms
      });
      
      // Enhanced music detection - consider it music if we have musical characteristics
      // Guitar and other instruments can have lower RMS but clear musical spectral content
      const hasMusicalSpectrum = spectralCentroid > 100 && spectralRolloff > 1000;
      const hasMusicalEnergy = rms > 0.005; // Lower threshold for quieter instruments like guitar
      const hasMusicalComplexity = zcr > 0.001; // Some harmonic complexity
      
      const isMusicDetected = !isVoice && hasMusicalSpectrum && hasMusicalEnergy && hasMusicalComplexity;
      
      // Calculate music confidence based on musical characteristics
      let musicConfidence = 0;
      if (hasMusicalSpectrum) musicConfidence += 0.4;
      if (hasMusicalEnergy) musicConfidence += 0.3;
      if (hasMusicalComplexity) musicConfidence += 0.2;
      if (spectralRolloff > 5000) musicConfidence += 0.1; // Rich harmonic content
      
      // Use music confidence if it's higher than voice confidence
      const finalConfidence = isMusicDetected ? Math.max(confidence, musicConfidence) : confidence;

      return {
        rms,
        spectralCentroid,
        spectralRolloff,
        zeroCrossingRate: zcr,
        tempo,
        key,
        genre,
        mood,
        instruments,
        isVoice,
        isSinging,
        isMusicDetected,
        confidence: finalConfidence
      };
    } catch (error) {
      console.error("Error in musicAnalyzer.analyzeAudio:", error);
      // Return safe default values on error
      return {
        rms: 0,
        spectralCentroid: 0,
        spectralRolloff: 0,
        zeroCrossingRate: 0,
        tempo: 120,
        key: 'C',
        genre: 'unknown',
        mood: 'neutral',
        instruments: [],
        isVoice: false,
        isSinging: false,
        isMusicDetected: false,
        confidence: 0
      };
    }
    }
  };
}

// Helper functions for enhanced analysis
function estimateTempo(zcr: number, spectralCentroid: number): number {
  // Simple tempo estimation based on zero crossing rate and spectral features
  const baseRate = zcr * 60; // Convert to BPM-like measure
  
  if (baseRate < 60) return Math.max(60, baseRate * 2);
  if (baseRate > 200) return Math.min(200, baseRate / 2);
  
  return Math.round(baseRate);
}

function estimateKey(chroma: number[]): string {
  if (!chroma || chroma.length === 0) return 'C';
  
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const maxIndex = chroma.indexOf(Math.max(...chroma));
  
  return keys[maxIndex % 12] || 'C';
}

function classifyGenre(spectralCentroid: number, spectralRolloff: number, tempo: number): string {
  // Simple genre classification based on spectral features and tempo
  const brightness = spectralCentroid / spectralRolloff;
  
  if (tempo < 80) {
    return brightness > 0.3 ? 'ballad' : 'ambient';
  } else if (tempo < 120) {
    return brightness > 0.4 ? 'pop' : 'folk';
  } else if (tempo < 140) {
    return brightness > 0.5 ? 'rock' : 'blues';
  } else {
    return brightness > 0.6 ? 'electronic' : 'punk';
  }
}

function analyzeMood(spectralCentroid: number, rms: number, tempo: number): string {
  const energy = rms;
  const brightness = spectralCentroid / 1000; // Normalize
  
  if (energy > 0.3 && tempo > 120) {
    return brightness > 0.5 ? 'energetic' : 'aggressive';
  } else if (energy > 0.2) {
    return brightness > 0.4 ? 'happy' : 'confident';
  } else {
    return brightness > 0.3 ? 'calm' : 'melancholic';
  }
}

function detectInstruments(spectralCentroid: number, spectralRolloff: number, mfcc: number[]): string[] {
  const instruments: string[] = [];
  const brightness = spectralCentroid / spectralRolloff;
  
  // Simple instrument detection based on spectral characteristics
  if (brightness > 0.6) {
    instruments.push('guitar', 'piano');
  } else if (brightness > 0.4) {
    instruments.push('vocals', 'strings');
  } else {
    instruments.push('bass', 'drums');
  }
  
  // Use MFCC for additional instrument hints
  if (mfcc && mfcc.length > 0) {
    const mfccVariance = mfcc.reduce((sum, val) => sum + Math.abs(val), 0) / mfcc.length;
    if (mfccVariance > 10) {
      instruments.push('percussion');
    }
  }
  
  return instruments;
}

function detectVoiceAndSinging(features: {
  spectralCentroid?: number;
  zcr?: number;
  rms?: number;
}): { isVoice: boolean; isSinging: boolean; confidence: number } {
  const { spectralCentroid = 0, zcr = 0, rms = 0 } = features;
  
  // Voice detection based on spectral characteristics
  const voiceRange = spectralCentroid > 200 && spectralCentroid < 2000;
  const voiceZCR = zcr > 0.01 && zcr < 0.3;
  const hasEnergy = rms > 0.01;
  
  const isVoice = voiceRange && voiceZCR && hasEnergy;
  
  // Singing detection (more melodic, sustained tones)
  const isSinging = isVoice && zcr < 0.15 && rms > 0.05;
  
  // Confidence based on how well features match voice characteristics
  let confidence = 0;
  if (voiceRange) confidence += 0.4;
  if (voiceZCR) confidence += 0.3;
  if (hasEnergy) confidence += 0.3;
  
  return { isVoice, isSinging, confidence };
}



// Helper function to format music analysis for OpenAI
export const formatMusicAnalysisForAI = (analysis: MusicAnalysis): string => {
  if (analysis.isVoice) {
    if (analysis.isSinging) {
      return "Vocal/singing detected in the audio input.";
    } else {
      return "Voice/speech detected in the audio input.";
    }
  }

  const parts = [];

  // Start with a natural description
  if (analysis.genre && analysis.genre !== 'unknown') {
    parts.push(`It sounds like ${analysis.genre} music`);
  } else {
    parts.push(`It's some kind of instrumental music`);
  }

  // Add mood and feel
  if (analysis.mood) {
    if (analysis.mood === 'energetic') {
      parts.push(`with an energetic, upbeat feel`);
    } else if (analysis.mood === 'calm') {
      parts.push(`with a calm, peaceful vibe`);
    } else if (analysis.mood === 'dynamic') {
      parts.push(`with a dynamic, changing character`);
    } else {
      parts.push(`with a ${analysis.mood} mood`);
    }
  }

  // Add instruments in a natural way
  if (analysis.instruments && analysis.instruments.length > 0) {
    const mainInstruments = analysis.instruments.filter(i => 
      i === 'guitar' || i === 'piano' || i === 'vocals' || i === 'strings'
    );
    if (mainInstruments.length > 0) {
      parts.push(`featuring ${mainInstruments[0]}`);
    }
  }

  // Add tempo feel instead of exact BPM
  if (analysis.tempo) {
    if (analysis.tempo > 200) {
      parts.push(`at a very fast pace`);
    } else if (analysis.tempo > 140) {
      parts.push(`at a fast tempo`);
    } else if (analysis.tempo > 100) {
      parts.push(`at a moderate pace`);
    } else {
      parts.push(`at a slower tempo`);
    }
  }

  // Add key in a musical context
  if (analysis.key) {
    parts.push(`in the key of ${analysis.key}`);
  }

  return parts.join(' ') + '.';
};