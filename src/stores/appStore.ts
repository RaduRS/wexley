import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, MusicSuggestion, RecordingSession } from '@/types';

interface AppState {
  // Settings
  settings: AppSettings;
  
  // Suggestions
  suggestions: MusicSuggestion[];
  currentSuggestion: MusicSuggestion | null;
  
  // Sessions
  currentSession: RecordingSession | null;
  sessions: RecordingSession[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  addSuggestion: (suggestion: MusicSuggestion) => void;
  setCurrentSuggestion: (suggestion: MusicSuggestion | null) => void;
  clearSuggestions: () => void;
  startSession: () => void;
  endSession: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: {
        audioInput: {
          deviceId: 'default',
          gain: 0.8,
          noiseGate: 0.1,
        },
        avatar: {
          personality: 'friendly',
          responseStyle: 'encouraging',
          animationSpeed: 1,
        },
        voice: {
          enabled: true,
          language: 'en-US',
          sensitivity: 0.7,
        },
        suggestions: {
          frequency: 'medium',
          types: ['drums', 'bass', 'harmony'],
          autoPlay: false,
        },
      },
      suggestions: [],
      currentSuggestion: null,
      currentSession: null,
      sessions: [],
      isLoading: false,
      error: null,

      // Actions
      updateSettings: (newSettings) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      addSuggestion: (suggestion) => {
        set(state => ({
          suggestions: [...state.suggestions, suggestion],
        }));
      },

      setCurrentSuggestion: (suggestion) => {
        set({ currentSuggestion: suggestion });
      },

      clearSuggestions: () => {
        set({ suggestions: [], currentSuggestion: null });
      },

      startSession: () => {
        const session: RecordingSession = {
          id: Math.random().toString(36).substr(2, 9),
          startTime: new Date(),
          audioData: [],
          suggestions: [],
          userActions: [],
        };
        
        set({ currentSession: session });
      },

      endSession: () => {
        const { currentSession } = get();
        if (currentSession) {
          const completedSession = {
            ...currentSession,
            endTime: new Date(),
          };
          
          set(state => ({
            currentSession: null,
            sessions: [...state.sessions, completedSession],
          }));
        }
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setError: (error) => {
        set({ error });
      },
    }),
    {
      name: 'wexly-app-storage',
      partialize: (state) => ({
        settings: state.settings,
        sessions: state.sessions.slice(-10), // Keep only last 10 sessions
      }),
    }
  )
);