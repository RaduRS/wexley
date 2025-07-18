import { MUSIC_THEORY } from '@/constants';

export type Note = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export function frequencyToNote(frequency: number): string {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  
  if (frequency > 0) {
    const h = Math.round(12 * Math.log2(frequency / C0));
    const octave = Math.floor(h / 12);
    const n = h % 12;
    return MUSIC_THEORY.NOTES[n] + octave;
  }
  return '';
}

export function noteToFrequency(note: Note, octave: number): number {
  const A4 = 440;
  const noteIndex = MUSIC_THEORY.NOTES.indexOf(note);
  if (noteIndex === -1) return 0;
  
  const semitones = (octave - 4) * 12 + (noteIndex - 9);
  return A4 * Math.pow(2, semitones / 12);
}

export function detectKey(chroma: number[]): string {
  // Simplified key detection using chroma features
  const majorProfiles = [
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1], // C major
    [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0], // C# major
    // Add more key profiles...
  ];
  
  let bestKey = 'C';
  let bestScore = 0;
  
  MUSIC_THEORY.NOTES.forEach((note, index) => {
    const profile = majorProfiles[0]; // Simplified - use C major profile
    let score = 0;
    
    for (let i = 0; i < 12; i++) {
      const chromaIndex = (i + index) % 12;
      score += chroma[chromaIndex] * profile[i];
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestKey = note;
    }
  });
  
  return bestKey;
}

export function detectTempo(onsets: number[]): number {
  // Simplified tempo detection
  if (onsets.length < 2) return 120;
  
  const intervals = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i] - onsets[i - 1]);
  }
  
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return Math.round(60 / avgInterval);
}

export function analyzeChordProgression(chords: string[]): {
  progression: string;
  key: string;
  quality: 'stable' | 'transitional' | 'complex';
} {
  // Simplified chord progression analysis
  return {
    progression: chords.join(' - '),
    key: 'C',
    quality: 'stable',
  };
}