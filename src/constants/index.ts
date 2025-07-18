export const AUDIO_CONFIG = {
  SAMPLE_RATE: 44100,
  BUFFER_SIZE: 4096,
  FFT_SIZE: 2048,
  HOP_SIZE: 512,
  MIN_FREQUENCY: 80,
  MAX_FREQUENCY: 8000,
  ANALYSIS_INTERVAL: 100, // ms
} as const;

export const MUSIC_THEORY = {
  NOTES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  CHORD_TYPES: ['major', 'minor', 'diminished', 'augmented', 'sus2', 'sus4', '7th'],
  SCALES: {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
  },
  TEMPO_RANGES: {
    slow: [60, 90],
    medium: [90, 120],
    fast: [120, 180],
    veryFast: [180, 240],
  },
} as const;

export const AVATAR_ANIMATIONS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  DANCING: 'dancing',
  THINKING: 'thinking',
  EXCITED: 'excited',
  SUGGESTING: 'suggesting',
} as const;

export const VOICE_COMMANDS = {
  YES: ['yes', 'yeah', 'sure', 'okay', 'add it'],
  NO: ['no', 'nope', 'skip', 'next'],
  STOP: ['stop', 'pause', 'halt'],
  PLAY: ['play', 'start', 'go'],
  AGAIN: ['again', 'repeat', 'once more'],
} as const;