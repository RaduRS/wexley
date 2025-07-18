export interface AvatarState {
  emotion: 'neutral' | 'excited' | 'listening' | 'thinking' | 'dancing' | 'suggesting';
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