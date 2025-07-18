export interface AudioAnalysis {
  pitch: number;
  volume: number;
  tempo: number;
  key: string;
  chords: string[];
  spectralCentroid: number;
  spectralRolloff: number;
  mfcc: number[];
  timestamp: number;
}

export interface AudioFeatures {
  rms: number;
  zcr: number;
  spectralCentroid: number;
  spectralBandwidth: number;
  spectralRolloff: number;
  mfcc: number[];
  chroma: number[];
  timestamp: number;
}

export interface MusicSuggestion {
  id: string;
  type: 'drums' | 'bass' | 'harmony' | 'melody';
  description: string;
  confidence: number;
  audioUrl?: string;
  parameters: {
    key: string;
    tempo: number;
    genre?: string;
  };
}

export interface AudioProcessorConfig {
  fftSize: number;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
  sampleRate: number;
  bufferSize: number;
  features: Record<string, boolean>;
}

export interface RecordingSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  audioData: AudioAnalysis[];
  suggestions: MusicSuggestion[];
  userActions: UserAction[];
}

export interface UserAction {
  type: 'accept_suggestion' | 'reject_suggestion' | 'voice_command' | 'play_along';
  timestamp: Date;
  data: Record<string, unknown>;
}