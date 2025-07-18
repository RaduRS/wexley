import { useEffect, useRef, useCallback, useState } from 'react';
import { useAudioStore } from '@/stores';
import { AudioProcessor } from '@/services';

export function useAudioProcessor() {
  const processorRef = useRef<AudioProcessor | null>(null);
  const isInitializedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const {
    isRecording,
    audioContext,
    analyser,
    updateAnalysis,
    updateFeatures,
    startRecording,
    stopRecording,
  } = useAudioStore();

  // Wrap store functions in useCallback to prevent dependency issues
  const stableUpdateAnalysis = useCallback(updateAnalysis, [updateAnalysis]);
  const stableUpdateFeatures = useCallback(updateFeatures, [updateFeatures]);
  const stableStopRecording = useCallback(stopRecording, [stopRecording]);

  // Initialize processor
  useEffect(() => {
    if (typeof window !== 'undefined') {
      processorRef.current = new AudioProcessor();
    }

    return () => {
      if (processorRef.current) {
        processorRef.current.dispose();
      }
      isInitializedRef.current = false;
      isProcessingRef.current = false;
    };
  }, []);

  // Start/stop processing when recording state changes
  useEffect(() => {
    const initializeAndStart = async () => {
      if (isRecording && processorRef.current && audioContext && analyser) {
        // Check if already initialized and running
        if (isInitializedRef.current || isProcessingRef.current) {
          console.log('⚠️ AudioProcessor already initialized/processing, skipping...');
          return;
        }
        
        try {
          isProcessingRef.current = true;
          setIsInitializing(true);
          setInitError(null);
          
          console.log('🎤 Initializing AudioProcessor with existing Scarlett interface context...');
          await processorRef.current.initialize(audioContext, analyser);
          
          console.log('▶️ Starting audio processing...');
          processorRef.current.start(stableUpdateAnalysis, stableUpdateFeatures);
          
          isInitializedRef.current = true;
          setIsInitializing(false);
        } catch (error) {
          console.error('❌ Failed to initialize AudioProcessor:', error);
          setInitError(error instanceof Error ? error.message : 'Unknown error');
          setIsInitializing(false);
          isProcessingRef.current = false;
          stableStopRecording(); // Stop recording if initialization fails
        }
      } else if (!isRecording && processorRef.current && isInitializedRef.current) {
        console.log('⏹️ Stopping audio processing...');
        processorRef.current.stop();
        isInitializedRef.current = false;
        isProcessingRef.current = false;
        setIsInitializing(false);
        setInitError(null);
      }
    };

    initializeAndStart();
  }, [isRecording, audioContext, analyser, stableUpdateAnalysis, stableUpdateFeatures, stableStopRecording]);

  const handleStartRecording = useCallback(async () => {
    try {
      setInitError(null);
      console.log('🎙️ Starting recording with Scarlett interface...');
      await startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
      setInitError(error instanceof Error ? error.message : 'Failed to start recording');
      throw error;
    }
  }, [startRecording]);

  const handleStopRecording = useCallback(() => {
    console.log('⏹️ Stopping recording...');
    stopRecording();
  }, [stopRecording]);

  return {
    isRecording,
    isInitializing,
    initError,
    startRecording: handleStartRecording,
    stopRecording: handleStopRecording,
  };
}