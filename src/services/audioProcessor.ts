import Meyda, { MeydaFeaturesObject, MeydaAudioFeature } from 'meyda';
import { AudioAnalysis, AudioFeatures, AudioProcessorConfig } from '@/types/audio';
import { AUDIO_CONFIG } from '@/constants';
import { detectKey } from '@/utils/music';

// Audio Context Manager - Functional approach
const createAudioContextManager = () => {
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;

  const initialize = async (config: AudioProcessorConfig): Promise<{ context: AudioContext; analyser: AnalyserNode }> => {
    if (typeof window === 'undefined') {
      throw new Error('AudioContext is not available in server-side environment');
    }

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new AudioContextClass();

    if (context.state === 'suspended') {
      await context.resume();
    }

    analyser = context.createAnalyser();
    analyser.fftSize = config.fftSize;
    analyser.smoothingTimeConstant = config.smoothingTimeConstant;
    analyser.minDecibels = config.minDecibels;
    analyser.maxDecibels = config.maxDecibels;

    return { context, analyser };
  };

  const setExisting = (existingContext: AudioContext, existingAnalyser: AnalyserNode): void => {
    context = existingContext;
    analyser = existingAnalyser;
  };

  const dispose = (): void => {
    if (context?.state !== 'closed') {
      context?.close();
    }
    context = null;
    analyser = null;
  };

  const getContext = (): AudioContext | null => context;
  const getAnalyser = (): AnalyserNode | null => analyser;

  return { initialize, setExisting, dispose, getContext, getAnalyser };
};

// Feature Extractor - Functional approach
const createFeatureExtractor = (config: AudioProcessorConfig) => {
  const initializeMeyda = (): void => {
    if (typeof window !== 'undefined' && typeof Meyda !== 'undefined') {
      Meyda.bufferSize = config.bufferSize;
      Meyda.sampleRate = config.sampleRate;
      Meyda.windowingFunction = 'hanning';
    }
  };

  const calculateSpectralBandwidth = (audioData: Float32Array): number => {
    const fftSize = audioData.length;
    const nyquist = config.sampleRate / 2;
    
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < fftSize / 2; i++) {
      const frequency = (i / (fftSize / 2)) * nyquist;
      const magnitude = Math.abs(audioData[i]);
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  };

  const extractFeatures = (audioData: Float32Array, audioContext: AudioContext): AudioFeatures | null => {
    if (typeof Meyda === 'undefined') {
      return null;
    }

    try {
      Meyda.audioContext = audioContext;

      const featureList: MeydaAudioFeature[] = [
        'rms',
        'zcr',
        'spectralCentroid',
        'spectralRolloff',
        'mfcc',
        'chroma'
      ];

      const features = Meyda.extract(featureList, audioData) as MeydaFeaturesObject;

      if (!features) {
        return null;
      }

      return {
        rms: features.rms ?? 0,
        zcr: features.zcr ?? 0,
        spectralCentroid: features.spectralCentroid ?? 0,
        spectralBandwidth: calculateSpectralBandwidth(audioData),
        spectralRolloff: features.spectralRolloff ?? 0,
        mfcc: features.mfcc ?? [],
        chroma: features.chroma ?? [],
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Failed to extract audio features:', error);
      return null;
    }
  };

  initializeMeyda();
  return { extractFeatures };
};

// Audio Analyzer - Functional approach
const createAudioAnalyzer = () => {
  const calculateRMS = (data: Float32Array): number => {
    const sum = data.reduce((acc, value) => acc + value * value, 0);
    return Math.sqrt(sum / data.length);
  };

  const detectChords = (chroma: number[]): string[] => {
    if (!chroma || chroma.length !== 12) return [];
    
    const threshold = 0.3;
    const activeNotes = chroma
      .map((value, index) => ({ value, note: index }))
      .filter(({ value }) => value > threshold)
      .map(({ note }) => note);

    if (activeNotes.length >= 3) {
      const root = activeNotes[0];
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      return [notes[root] + 'maj'];
    }

    return [];
  };

  const estimateTempo = (): number => {
    // Simplified tempo estimation - in production, use proper onset detection
    return 120;
  };

  const analyzeAudio = (timeData: Float32Array, features: AudioFeatures): AudioAnalysis => {
    const rms = features.rms || calculateRMS(timeData);
    const volume = Math.max(0, Math.min(1, rms * 10));
    const pitch = features.spectralCentroid || 0;
    const key = features.chroma.length > 0 ? detectKey(features.chroma) : 'C';
    const chords = detectChords(features.chroma);
    const tempo = estimateTempo();

    return {
      pitch,
      volume,
      tempo,
      key,
      chords,
      spectralCentroid: features.spectralCentroid,
      spectralRolloff: features.spectralRolloff,
      mfcc: features.mfcc,
      timestamp: Date.now(),
    };
  };

  return { analyzeAudio };
};

// Microphone Manager - New addition for better feedback
const createMicrophoneManager = () => {
  let mediaStream: MediaStream | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;

  const requestMicrophone = async (): Promise<MediaStream> => {
    try {
      console.log('🎤 Requesting microphone access...');
      
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
        }
      });

      console.log('✅ Microphone access granted!');
      console.log('🎵 Audio tracks:', mediaStream.getAudioTracks().map(track => ({
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState
      })));

      return mediaStream;
    } catch (error) {
      console.error('❌ Failed to access microphone:', error);
      throw error;
    }
  };

  const connectToAnalyser = (audioContext: AudioContext, analyser: AnalyserNode): void => {
    if (!mediaStream) {
      throw new Error('No media stream available');
    }

    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    sourceNode.connect(analyser);
    
    console.log('🔗 Microphone connected to analyser');
    console.log('📊 Analyser settings:', {
      fftSize: analyser.fftSize,
      frequencyBinCount: analyser.frequencyBinCount,
      minDecibels: analyser.minDecibels,
      maxDecibels: analyser.maxDecibels
    });
  };

  const dispose = (): void => {
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped audio track:', track.label);
      });
      mediaStream = null;
    }
  };

  const getStream = (): MediaStream | null => mediaStream;

  return { requestMicrophone, connectToAnalyser, dispose, getStream };
};

// Main AudioProcessor - Modern functional implementation
export const createAudioProcessor = (config?: Partial<AudioProcessorConfig>) => {
  const processorConfig: AudioProcessorConfig = {
    fftSize: AUDIO_CONFIG.FFT_SIZE,
    smoothingTimeConstant: 0.8,
    minDecibels: -90,
    maxDecibels: -10,
    sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
    bufferSize: AUDIO_CONFIG.BUFFER_SIZE,
    features: {
      rms: true,
      zcr: true,
      spectralCentroid: true,
      spectralBandwidth: true,
      spectralRolloff: true,
      mfcc: true,
      chroma: true,
    },
    ...config,
  };

  const contextManager = createAudioContextManager();
  const featureExtractor = createFeatureExtractor(processorConfig);
  const analyzer = createAudioAnalyzer();
  const microphoneManager = createMicrophoneManager();
  
  let dataArray: Float32Array | null = null;
  let isProcessing = false;
  let animationFrameId: number | null = null;
  let lastUpdateTime = 0;
  let frameCount = 0;
  
  // Smoothing for pitch detection
  let pitchHistory: number[] = [];
  let lastStablePitch: number | null = null;
  
  let onAnalysisCallback: ((analysis: AudioAnalysis) => void) | undefined;
  let onFeaturesCallback: ((features: AudioFeatures) => void) | undefined;

  const initialize = async (existingContext?: AudioContext, existingAnalyser?: AnalyserNode): Promise<void> => {
    try {
      console.log('🚀 Initializing AudioProcessor...');
      
      let context: AudioContext;
      let analyser: AnalyserNode;
      
      if (existingContext && existingAnalyser) {
        console.log('📡 Using existing audio context and analyser from store');
        context = existingContext;
        analyser = existingAnalyser;
        contextManager.setExisting(context, analyser);
      } else {
        console.log('🔧 Creating new audio context and analyser');
        const result = await contextManager.initialize(processorConfig);
        context = result.context;
        analyser = result.analyser;
        
        // Request microphone access only if we created our own context
        await microphoneManager.requestMicrophone();
        microphoneManager.connectToAnalyser(context, analyser);
      }
      
      dataArray = new Float32Array(analyser.frequencyBinCount);
      
      console.log('✅ AudioProcessor initialized successfully!');
    } catch (error) {
      console.error('❌ Failed to initialize audio processor:', error);
      throw error;
    }
  };

  const start = (
    onAnalysis: (analysis: AudioAnalysis) => void,
    onFeatures: (features: AudioFeatures) => void
  ): void => {
    const analyser = contextManager.getAnalyser();
    
    if (!analyser || !dataArray) {
      throw new Error('AudioProcessor not initialized');
    }

    console.log('▶️ Starting audio processing...');
    
    onAnalysisCallback = onAnalysis;
    onFeaturesCallback = onFeatures;
    isProcessing = true;
    processAudio();
  };

  const stop = (): void => {
    console.log('⏹️ Stopping audio processing...');
    
    isProcessing = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    // Reset smoothing variables
    lastUpdateTime = 0;
    frameCount = 0;
    pitchHistory = [];
    lastStablePitch = null;
  };

  const processAudio = (): void => {
    if (!isProcessing) {
      return;
    }

    const analyser = contextManager.getAnalyser();
    const audioContext = contextManager.getContext();
    
    if (!analyser || !audioContext || !dataArray) {
      return;
    }

    const currentTime = performance.now();
    frameCount++;
    
    // Throttle updates to ~10 FPS instead of 60 FPS
    const shouldUpdate = currentTime - lastUpdateTime >= 100; // 100ms = 10 FPS
    
    if (shouldUpdate) {
      lastUpdateTime = currentTime;
      
      // Get time domain data for Meyda
      const timeData = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(timeData);

      // Check for actual audio input (but don't log every frame)
      const hasAudioInput = timeData.some(sample => Math.abs(sample) > 0.001);
      
      if (hasAudioInput && frameCount % 60 === 0) { // Log only once per second
        console.log('🎵 Audio input detected! RMS:', Math.sqrt(timeData.reduce((sum, val) => sum + val * val, 0) / timeData.length));
      }

      try {
        // Extract features
        const features = featureExtractor.extractFeatures(timeData, audioContext);
        
        if (features && onFeaturesCallback) {
          onFeaturesCallback(features);
        }

        // Perform higher-level analysis with pitch smoothing
        if (features) {
          const analysis = analyzer.analyzeAudio(timeData, features);
          
          // Smooth pitch detection
          if (analysis.pitch && analysis.pitch > 0) {
            pitchHistory.push(analysis.pitch);
            
            // Keep only last 5 pitch values for smoothing
            if (pitchHistory.length > 5) {
              pitchHistory.shift();
            }
            
            // Calculate median pitch for stability
            const sortedPitches = [...pitchHistory].sort((a, b) => a - b);
            const medianPitch = sortedPitches[Math.floor(sortedPitches.length / 2)];
            
            // Only update if pitch is stable (within 10% of median)
            if (!lastStablePitch || Math.abs(medianPitch - lastStablePitch) / lastStablePitch > 0.1) {
              lastStablePitch = medianPitch;
              analysis.pitch = medianPitch;
              onAnalysisCallback?.(analysis);
            }
          } else {
            // No pitch detected, clear history
            pitchHistory = [];
            lastStablePitch = null;
            onAnalysisCallback?.(analysis);
          }
        }
      } catch (error) {
        console.warn('⚠️ Audio analysis error:', error);
      }
    }

    // Continue the animation loop
    animationFrameId = requestAnimationFrame(processAudio);
  };

  const getFeatures = (): AudioFeatures | null => {
    const audioContext = contextManager.getContext();
    const analyser = contextManager.getAnalyser();
    
    if (!isProcessing || !audioContext || !analyser) {
      return null;
    }

    const timeData = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeData);
    
    return featureExtractor.extractFeatures(timeData, audioContext);
  };

  const setConfig = (newConfig: Partial<AudioProcessorConfig>): void => {
    Object.assign(processorConfig, newConfig);
  };

  const getConfig = (): AudioProcessorConfig => ({ ...processorConfig });

  const dispose = (): void => {
    console.log('🧹 Disposing AudioProcessor...');
    
    stop();
    microphoneManager.dispose();
    contextManager.dispose();
    dataArray = null;
    onAnalysisCallback = undefined;
    onFeaturesCallback = undefined;
  };

  return {
    initialize,
    start,
    stop,
    getFeatures,
    setConfig,
    getConfig,
    dispose
  };
};

// Legacy class wrapper for backward compatibility
export class AudioProcessor {
  private processor = createAudioProcessor();

  constructor(config?: Partial<AudioProcessorConfig>) {
    if (config) {
      this.processor.setConfig(config);
    }
  }

  async initialize(existingContext?: AudioContext, existingAnalyser?: AnalyserNode): Promise<void> {
    return this.processor.initialize(existingContext, existingAnalyser);
  }

  start(
    onAnalysis: (analysis: AudioAnalysis) => void,
    onFeatures: (features: AudioFeatures) => void
  ): void {
    return this.processor.start(onAnalysis, onFeatures);
  }

  stop(): void {
    return this.processor.stop();
  }

  getFeatures(): AudioFeatures | null {
    return this.processor.getFeatures();
  }

  setConfig(newConfig: Partial<AudioProcessorConfig>): void {
    return this.processor.setConfig(newConfig);
  }

  getConfig(): AudioProcessorConfig {
    return this.processor.getConfig();
  }

  dispose(): void {
    return this.processor.dispose();
  }
}