export interface AvatarState {
  emotion: 'neutral' | 'excited' | 'listening' | 'thinking' | 'dancing' | 'suggesting' 
    | 'speaking' | 'processing' | 'understanding' | 'empathetic' | 'curious'
    | 'helpful' | 'encouraging' | 'celebrating' | 'concerned' | 'focused';
  isAnimating: boolean;
  currentAnimation: string;
  scale: number;
  position: { x: number; y: number };
}

export interface AvatarConfig {
  personality: 'friendly' | 'professional' | 'energetic' | 'calm';
  responseStyle: 'encouraging' | 'analytical' | 'creative';
  animationSpeed: number;
}

export interface VoiceCommand {
  command: string;
  confidence: number;
  timestamp: Date;
  processed: boolean;
}

export interface AppSettings {
  audioInput: {
    deviceId: string;
    gain: number;
    noiseGate: number;
  };
  avatar: AvatarConfig;
  voice: {
    enabled: boolean;
    language: string;
    sensitivity: number;
  };
  suggestions: {
    frequency: 'low' | 'medium' | 'high';
    types: string[];
    autoPlay: boolean;
  };
}

export interface TranscriptMessage {
  id: string;
  transcript: string;
  isFinal: boolean;
  confidence: number;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface RealtimeState {
  isConnected: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  finalTranscript: string;
  conversation: ChatMessage[];
  error: string | null;
}

export interface DeepgramEvent {
  type: 'transcript' | 'speech_started' | 'utterance_end' | 'error';
  transcript?: string;
  isFinal?: boolean;
  confidence?: number;
  error?: string;
}