import { create } from 'zustand';
import type { AvatarState, AvatarConfig } from '@/types';
import { AVATAR_ANIMATIONS } from '@/constants';

interface AvatarStore extends AvatarState {
  config: AvatarConfig;
  
  // Actions
  setEmotion: (emotion: AvatarState['emotion']) => void;
  setAnimation: (animation: string) => void;
  setPosition: (position: { x: number; y: number }) => void;
  setScale: (scale: number) => void;
  updateConfig: (config: Partial<AvatarConfig>) => void;
  startAnimation: () => void;
  stopAnimation: () => void;
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  // Initial state
  emotion: 'neutral',
  isAnimating: false,
  currentAnimation: AVATAR_ANIMATIONS.IDLE,
  scale: 1,
  position: { x: 0, y: 0 },
  config: {
    personality: 'friendly',
    responseStyle: 'encouraging',
    animationSpeed: 1,
  },

  // Actions
  setEmotion: (emotion) => {
    set({ emotion });
    
    // Auto-set animation based on emotion
    const animationMap = {
      neutral: AVATAR_ANIMATIONS.IDLE,
      excited: AVATAR_ANIMATIONS.EXCITED,
      listening: AVATAR_ANIMATIONS.LISTENING,
      thinking: AVATAR_ANIMATIONS.THINKING,
      dancing: AVATAR_ANIMATIONS.DANCING,
      suggesting: AVATAR_ANIMATIONS.SUGGESTING,
    };
    
    set({ currentAnimation: animationMap[emotion] });
  },

  setAnimation: (animation) => {
    set({ currentAnimation: animation });
  },

  setPosition: (position) => {
    set({ position });
  },

  setScale: (scale) => {
    set({ scale: Math.max(0.1, Math.min(3, scale)) }); // Clamp between 0.1 and 3
  },

  setConfig: (config: Partial<AvatarConfig>) => {
    set((state) => ({
      config: { ...state.config, ...config }
    }));
  },

  updateConfig: (config) => {
    set((state) => ({
      config: { ...state.config, ...config }
    }));
  },

  startAnimation: () => {
    set({ isAnimating: true });
  },

  stopAnimation: () => {
    set({ isAnimating: false });
  },
}));