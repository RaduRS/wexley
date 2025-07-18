import { create } from 'zustand';
import type { AvatarState, AvatarConfig } from '@/types';
import { AVATAR_ANIMATIONS } from '@/constants';

// Extended emotions for AI companion
export type CompanionEmotion = 
  | 'neutral' | 'excited' | 'listening' | 'thinking' | 'dancing' | 'suggesting'
  | 'speaking' | 'processing' | 'understanding' | 'empathetic' | 'curious'
  | 'helpful' | 'encouraging' | 'celebrating' | 'concerned' | 'focused';

interface CompanionState {
  isProcessing: boolean;
  lastInteraction: Date | null;
  conversationContext: 'greeting' | 'question' | 'explanation' | 'casual' | 'problem-solving';
  energyLevel: number; // 0-100
  attentionLevel: number; // 0-100
}

interface AvatarStore extends AvatarState {
  config: AvatarConfig;
  companion: CompanionState;
  
  // Emotion debouncing state
  lastEmotionChange: number;
  emotionTimeout: NodeJS.Timeout | null;
  pendingEmotion: CompanionEmotion | null;
  
  // Actions
  setEmotion: (emotion: CompanionEmotion, force?: boolean) => void;
  setAnimation: (animation: string) => void;
  setPosition: (position: { x: number; y: number }) => void;
  setScale: (scale: number) => void;
  updateConfig: (config: Partial<AvatarConfig>) => void;
  startAnimation: () => void;
  stopAnimation: () => void;
  
  // AI Companion specific actions
  reactToUserInput: (inputType: 'voice' | 'text', content?: string) => void;
  reactToAIResponse: (responseType: 'thinking' | 'speaking' | 'finished') => void;
  setProcessingState: (isProcessing: boolean) => void;
  updateEnergyLevel: (level: number) => void;
  updateAttentionLevel: (level: number) => void;
  setConversationContext: (context: CompanionState['conversationContext']) => void;
  celebrateSuccess: () => void;
  showConcern: () => void;
  expressEmpathy: () => void;
}

export const useAvatarStore = create<AvatarStore>((set, get) => ({
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
  companion: {
    isProcessing: false,
    lastInteraction: null,
    conversationContext: 'greeting',
    energyLevel: 80,
    attentionLevel: 100,
  },
  
  // Emotion debouncing state
  lastEmotionChange: 0,
  emotionTimeout: null,
  pendingEmotion: null,

  // Actions
  setEmotion: (emotion, force = false) => {
    const state = get();
    const now = Date.now();
    const timeSinceLastChange = now - state.lastEmotionChange;
    const MIN_EMOTION_DURATION = 3000; // 3 seconds
    
    // If same emotion, do nothing
    if (state.emotion === emotion && !force) {
      return;
    }
    
    // Clear any existing timeout
    if (state.emotionTimeout) {
      clearTimeout(state.emotionTimeout);
    }
    
    // If enough time has passed or this is a force update, change immediately
    if (timeSinceLastChange >= MIN_EMOTION_DURATION || force || state.lastEmotionChange === 0) {
      set({ 
        emotion,
        lastEmotionChange: now,
        emotionTimeout: null,
        pendingEmotion: null
      });
      
      // Auto-set animation based on emotion with enhanced mapping
      const animationMap: Record<CompanionEmotion, string> = {
        neutral: AVATAR_ANIMATIONS.IDLE,
        excited: AVATAR_ANIMATIONS.EXCITED,
        listening: AVATAR_ANIMATIONS.LISTENING,
        thinking: AVATAR_ANIMATIONS.THINKING,
        dancing: AVATAR_ANIMATIONS.DANCING,
        suggesting: AVATAR_ANIMATIONS.SUGGESTING,
        speaking: AVATAR_ANIMATIONS.EXCITED, // Use excited for speaking
        processing: AVATAR_ANIMATIONS.THINKING,
        understanding: AVATAR_ANIMATIONS.LISTENING,
        empathetic: AVATAR_ANIMATIONS.IDLE,
        curious: AVATAR_ANIMATIONS.LISTENING,
        helpful: AVATAR_ANIMATIONS.SUGGESTING,
        encouraging: AVATAR_ANIMATIONS.EXCITED,
        celebrating: AVATAR_ANIMATIONS.DANCING,
        concerned: AVATAR_ANIMATIONS.THINKING,
        focused: AVATAR_ANIMATIONS.LISTENING,
      };
      
      set({ currentAnimation: animationMap[emotion] });
      
      // After setting emotion, schedule return to appropriate state
      if (emotion !== 'listening' && emotion !== 'neutral') {
        const returnTimeout = setTimeout(() => {
          // Check if we should return to listening (if recording) or neutral
          // Import the audio store to check recording state
          import('./audioStore').then(({ useAudioStore }) => {
            const audioState = useAudioStore.getState();
            const isRecording = audioState?.isRecording;
            
            if (isRecording) {
              get().setEmotion('listening', true);
            } else {
              get().setEmotion('neutral', true);
            }
          }).catch(() => {
            // Fallback to neutral if audio store is not available
            get().setEmotion('neutral', true);
          });
        }, MIN_EMOTION_DURATION);
        
        // Store the return timeout (we'll clear it if emotion changes)
        set({ emotionTimeout: returnTimeout });
      }
    } else {
      // Schedule the emotion change for later
      const remainingTime = MIN_EMOTION_DURATION - timeSinceLastChange;
      
      set({ pendingEmotion: emotion });
      
      const timeout = setTimeout(() => {
        const currentState = get();
        if (currentState.pendingEmotion === emotion) {
          get().setEmotion(emotion, true);
        }
      }, remainingTime);
      
      set({ emotionTimeout: timeout });
    }
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

  // AI Companion specific actions
  reactToUserInput: (inputType, content) => {
    const state = get();
    
    set((state) => ({
      companion: {
        ...state.companion,
        lastInteraction: new Date(),
        attentionLevel: Math.min(100, state.companion.attentionLevel + 10),
      }
    }));

    if (inputType === 'voice') {
      get().setEmotion('listening');
      get().startAnimation();
      
      // Analyze content for context if provided
      if (content) {
        if (content.includes('?')) {
          get().setConversationContext('question');
        } else if (content.includes('help') || content.includes('problem')) {
          get().setConversationContext('problem-solving');
        } else {
          get().setConversationContext('casual');
        }
      }
    } else {
      get().setEmotion('understanding');
    }
  },

  reactToAIResponse: (responseType) => {
    switch (responseType) {
      case 'thinking':
        get().setEmotion('processing');
        get().setProcessingState(true);
        break;
      case 'speaking':
        get().setEmotion('speaking');
        get().setProcessingState(false);
        break;
      case 'finished':
        // Don't automatically return to neutral - let the AI's response content determine the emotion
        // or stay in the current speaking/helpful state
        get().setEmotion('helpful');
        get().setProcessingState(false);
        break;
    }
  },

  setProcessingState: (isProcessing) => {
    set((state) => ({
      companion: {
        ...state.companion,
        isProcessing,
      }
    }));
  },

  updateEnergyLevel: (level) => {
    set((state) => ({
      companion: {
        ...state.companion,
        energyLevel: Math.max(0, Math.min(100, level)),
      }
    }));
  },

  updateAttentionLevel: (level) => {
    set((state) => ({
      companion: {
        ...state.companion,
        attentionLevel: Math.max(0, Math.min(100, level)),
      }
    }));
  },

  setConversationContext: (context) => {
    set((state) => ({
      companion: {
        ...state.companion,
        conversationContext: context,
      }
    }));
  },

  celebrateSuccess: () => {
    get().setEmotion('celebrating');
    get().startAnimation();
    setTimeout(() => {
      get().setEmotion('encouraging');
    }, 3000);
  },

  showConcern: () => {
    get().setEmotion('concerned');
    get().startAnimation();
  },

  expressEmpathy: () => {
    get().setEmotion('empathetic');
    get().startAnimation();
    setTimeout(() => {
      get().setEmotion('helpful');
    }, 2000);
  },
}));