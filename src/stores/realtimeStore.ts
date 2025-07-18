import { create } from 'zustand';
import { RealtimeState, ChatMessage } from '@/types';
import { useAvatarStore } from './avatarStore';
import type { CompanionEmotion } from './avatarStore';

interface RealtimeStore extends RealtimeState {
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Transcription
  updateTranscript: (transcript: string, isFinal: boolean, confidence: number) => void;
  clearTranscript: () => void;
  
  // Chat
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateStreamingMessage: (content: string) => void;
  finishStreamingMessage: () => void;
  clearConversation: () => void;
  
  // State updates
  setConnected: (connected: boolean) => void;
  setTranscribing: (transcribing: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setError: (error: string | null) => void;
  
  // Audio processing
  processAudioBlob: (audioBlob: Blob) => Promise<void>;
  sendToOpenAI: (transcript: string) => Promise<void>;
  parseAvatarInstructions: (response: string) => void;
  
  // Audio recording
  mediaRecorder: MediaRecorder | null;
  audioStream: MediaStream | null;
  recordingChunks: Blob[];
}

export const useRealtimeStore = create<RealtimeStore>((set, get) => ({
  // Initial state
  isConnected: false,
  isTranscribing: false,
  isSpeaking: false,
  currentTranscript: '',
  finalTranscript: '',
  conversation: [],
  error: null,
  mediaRecorder: null,
  audioStream: null,
  recordingChunks: [],

  // Connection management
  connect: async () => {
    try {
      const state = get();
      if (state.isConnected || state.mediaRecorder) {
        console.log('Already connected or connecting...');
        return;
      }

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      let recordingChunks: Blob[] = [];
      let silenceTimer: NodeJS.Timeout | null = null;
      let isRecording = false;

      // Audio level detection for voice activity
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        // Voice activity detection threshold (increased for better detection)
        const isVoiceActive = average > 25;
        
        if (isVoiceActive && !isRecording) {
          // Start recording
          console.log('Voice detected, starting recording...');
          recordingChunks = [];
          mediaRecorder.start();
          isRecording = true;
          set({ isSpeaking: true });
          
          if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
          }
        } else if (!isVoiceActive && isRecording) {
          // Start silence timer
          if (!silenceTimer) {
            silenceTimer = setTimeout(() => {
              if (isRecording) {
                console.log('Silence detected, stopping recording...');
                mediaRecorder.stop();
                isRecording = false;
                set({ isSpeaking: false });
              }
            }, 1500); // Stop after 1.5 seconds of silence
          }
        } else if (isVoiceActive && isRecording && silenceTimer) {
          // Cancel silence timer if voice detected again
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
        
        const currentState = get();
        if (currentState.isConnected) {
          requestAnimationFrame(checkAudioLevel);
        }
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (recordingChunks.length > 0) {
          const audioBlob = new Blob(recordingChunks, { type: 'audio/webm' });
          await get().processAudioBlob(audioBlob);
        }
      };

      set({
        mediaRecorder,
        audioStream: stream,
        isConnected: true,
        isTranscribing: true,
        error: null,
      });

      // Start audio level monitoring
      checkAudioLevel();

    } catch (error) {
      console.error('Failed to connect:', error);
      set({ error: 'Failed to connect to microphone' });
    }
  },

  disconnect: () => {
    const state = get();
    
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
      state.mediaRecorder.stop();
    }
    
    if (state.audioStream) {
      state.audioStream.getTracks().forEach(track => track.stop());
    }

    set({
      isConnected: false,
      isTranscribing: false,
      isSpeaking: false,
      mediaRecorder: null,
      audioStream: null,
      currentTranscript: '',
      recordingChunks: [],
    });
  },

  // Process audio blob
  processAudioBlob: async (audioBlob: Blob) => {
    try {
      console.log('Processing audio blob...');
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Send to Deepgram
      const response = await fetch('/api/deepgram/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio: base64Audio }),
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      console.log('Transcription result:', data);
      
      if (data.transcript && data.transcript.trim()) {
        get().updateTranscript(data.transcript, true, data.confidence);
        // Send to OpenAI
        await get().sendToOpenAI(data.transcript);
      }

    } catch (error) {
      console.error('Error processing audio:', error);
      get().setError('Failed to process audio');
    }
  },

  // Transcription methods
  updateTranscript: (transcript: string, isFinal: boolean, confidence: number) => {
    if (isFinal) {
      set(state => ({
        finalTranscript: state.finalTranscript + ' ' + transcript,
        currentTranscript: '',
      }));
    } else {
      set({ currentTranscript: transcript });
    }
  },

  clearTranscript: () => {
    set({ currentTranscript: '', finalTranscript: '' });
  },

  // Chat methods
  addMessage: (message) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    
    set(state => ({
      conversation: [...state.conversation, newMessage]
    }));
  },

  updateStreamingMessage: (content: string) => {
    set(state => {
      const conversation = [...state.conversation];
      const lastMessage = conversation[conversation.length - 1];
      
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
        lastMessage.content += content;
      } else {
        conversation.push({
          id: Date.now().toString(),
          role: 'assistant',
          content,
          timestamp: new Date(),
          isStreaming: true,
        });
      }
      
      return { conversation };
    });
  },

  finishStreamingMessage: () => {
    set(state => {
      const conversation = [...state.conversation];
      const lastMessage = conversation[conversation.length - 1];
      
      if (lastMessage && lastMessage.isStreaming) {
        lastMessage.isStreaming = false;
      }
      
      return { conversation };
    });
  },

  clearConversation: () => {
    set({ conversation: [] });
  },

  // State setters
  setConnected: (connected: boolean) => set({ isConnected: connected }),
  setTranscribing: (transcribing: boolean) => set({ isTranscribing: transcribing }),
  setSpeaking: (speaking: boolean) => set({ isSpeaking: speaking }),
  setError: (error: string | null) => set({ error }),

  // Send to OpenAI
  sendToOpenAI: async (transcript: string) => {
    try {
      console.log('Sending to OpenAI:', transcript);
      const state = get();
      
      // Trigger avatar reaction to user input
      const avatarStore = useAvatarStore.getState();
      avatarStore.reactToUserInput('voice', transcript);
      
      // Add user message
      state.addMessage({
        role: 'user',
        content: transcript,
      });

      // Prepare conversation for API
      const conversation = state.conversation
        .filter(msg => !msg.isStreaming)
        .map(msg => ({ role: msg.role, content: msg.content }));

      // Trigger thinking state
      avatarStore.reactToAIResponse('thinking');

      // Start streaming response
      const response = await fetch('/api/openai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: transcript,
          conversation: conversation.slice(-10), // Keep last 10 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';
      
      // Trigger speaking state when response starts
      avatarStore.reactToAIResponse('speaking');
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.content) {
                fullResponse += data.content;
                state.updateStreamingMessage(data.content);
              } else if (data.done) {
                state.finishStreamingMessage();
                
                // Parse avatar instructions from the complete response
                state.parseAvatarInstructions(fullResponse);
                
                // Trigger finished state
                avatarStore.reactToAIResponse('finished');
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }

    } catch (error) {
      console.error('Error sending to OpenAI:', error);
      const state = get();
      state.setError('Failed to get AI response');
      
      // Show concern on error
      const avatarStore = useAvatarStore.getState();
      avatarStore.showConcern();
    }
  },

  // Parse avatar instructions from AI response
  parseAvatarInstructions: (response: string) => {
    const avatarMatch = response.match(/\[AVATAR:\s*(\w+)\]/i);
    if (avatarMatch) {
      const emotion = avatarMatch[1].toLowerCase() as CompanionEmotion;
      const avatarStore = useAvatarStore.getState();
      
      // Validate emotion exists
      const validEmotions: CompanionEmotion[] = [
        'neutral', 'excited', 'listening', 'thinking', 'dancing', 'suggesting',
        'speaking', 'processing', 'understanding', 'empathetic', 'curious',
        'helpful', 'encouraging', 'celebrating', 'concerned', 'focused'
      ];
      
      if (validEmotions.includes(emotion)) {
        avatarStore.setEmotion(emotion);
        avatarStore.startAnimation();
        
        // Clean up the response by removing avatar instructions
        const cleanResponse = response.replace(/\[AVATAR:\s*\w+\]/gi, '').trim();
        
        // Update the last message with clean content
        set(state => {
          const conversation = [...state.conversation];
          const lastMessage = conversation[conversation.length - 1];
          
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = cleanResponse;
          }
          
          return { conversation };
        });
      }
    }
  },
}));