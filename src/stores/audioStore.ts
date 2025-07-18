import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AudioAnalysis, AudioFeatures, AudioProcessorConfig } from '@/types';

interface AudioState {
  // Audio stream and processing
  isRecording: boolean;
  audioStream: MediaStream | null;
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  
  // Real-time analysis data
  currentAnalysis: AudioAnalysis | null;
  analysis: AudioAnalysis | null; // Alias for currentAnalysis
  analysisHistory: AudioAnalysis[];
  features: AudioFeatures | null;
  
  // Configuration
  config: AudioProcessorConfig;
  
  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  updateAnalysis: (analysis: AudioAnalysis) => void;
  updateFeatures: (features: AudioFeatures) => void;
  setConfig: (config: Partial<AudioProcessorConfig>) => void;
  clearHistory: () => void;
}

export const useAudioStore = create<AudioState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isRecording: false,
    audioStream: null,
    audioContext: null,
    analyser: null,
    currentAnalysis: null,
    analysis: null, // Alias for currentAnalysis
    analysisHistory: [],
    features: null,
    config: {
      sampleRate: 44100,
      bufferSize: 4096,
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      minDecibels: -100,
      maxDecibels: -30,
      features: {
        mfcc: true,
        chroma: true,
        spectralCentroid: true,
        spectralRolloff: true,
        spectralFlatness: true,
        rms: true,
        zcr: true
      },
// sampleRate is already defined above, removing duplicate
      // bufferSize: 4096,
      // fftSize: 2048,
      // Removed hopSize as it's not defined in AudioProcessorConfig type
    },

    // Actions
    startRecording: async () => {
      try {
        console.log('🎤 Requesting microphone access for Scarlett interface...');
        
        // First, enumerate available audio devices
        let selectedDeviceId: string | undefined;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === 'audioinput');
          console.log('🎧 Available audio input devices:', audioInputs.map(device => ({
            deviceId: device.deviceId,
            label: device.label,
            groupId: device.groupId
          })));
          
          // Look for Scarlett device
          const scarlettDevice = audioInputs.find(device => 
            device.label.toLowerCase().includes('scarlett') ||
            device.label.toLowerCase().includes('focusrite')
          );
          
          if (scarlettDevice) {
            console.log('🎯 Found Scarlett device:', scarlettDevice.label);
            selectedDeviceId = scarlettDevice.deviceId;
            console.log('🔧 Will use Scarlett device ID:', selectedDeviceId);
          } else {
            console.log('⚠️ Scarlett device not found, using default');
          }
        } catch (deviceError) {
          console.warn('⚠️ Could not enumerate devices:', deviceError);
        }
        
        const audioConstraints: MediaTrackConstraints = {
           echoCancellation: false,
           noiseSuppression: false,
           autoGainControl: false,
           sampleRate: get().config.sampleRate,
           channelCount: 1,
         };
        
        // Add device ID if Scarlett was found
        if (selectedDeviceId) {
          audioConstraints.deviceId = { exact: selectedDeviceId };
        }
        
        console.log('🎤 Using audio constraints:', audioConstraints);
        
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
        
        console.log('✅ Microphone access granted:', {
          tracks: stream.getAudioTracks().length,
          settings: stream.getAudioTracks()[0]?.getSettings(),
        });

        const audioContext = new AudioContext({
          sampleRate: get().config.sampleRate,
        });
        
        console.log('🔊 Audio context created:', {
          sampleRate: audioContext.sampleRate,
          state: audioContext.state,
        });

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = get().config.fftSize;
        analyser.smoothingTimeConstant = get().config.smoothingTimeConstant;
        analyser.minDecibels = get().config.minDecibels;
        analyser.maxDecibels = get().config.maxDecibels;
        
        console.log('📊 Analyser configured:', {
          fftSize: analyser.fftSize,
          frequencyBinCount: analyser.frequencyBinCount,
          smoothingTimeConstant: analyser.smoothingTimeConstant,
        });

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        console.log('🔗 Audio source connected to analyser');
        
        // Test if we're getting audio data
        const testData = new Float32Array(analyser.frequencyBinCount);
        const timeData = new Float32Array(analyser.fftSize);
        
        setTimeout(() => {
          analyser.getFloatFrequencyData(testData);
          analyser.getFloatTimeDomainData(timeData);
          
          const hasSignal = testData.some(val => val > -100);
          const hasTimeSignal = timeData.some(val => Math.abs(val) > 0.001);
          const rms = Math.sqrt(timeData.reduce((sum, val) => sum + val * val, 0) / timeData.length);
          
          console.log('🧪 Initial audio test:', {
            hasFrequencySignal: hasSignal,
            hasTimeSignal: hasTimeSignal,
            rmsLevel: rms,
            maxFrequency: Math.max(...testData),
            minFrequency: Math.min(...testData),
            maxTime: Math.max(...timeData),
            minTime: Math.min(...timeData),
            streamActive: stream.active,
            trackEnabled: stream.getAudioTracks()[0]?.enabled,
            trackReadyState: stream.getAudioTracks()[0]?.readyState,
          });
          
          // Try a continuous test for 5 seconds
          let testCount = 0;
          const continuousTest = setInterval(() => {
            analyser.getFloatTimeDomainData(timeData);
            const currentRms = Math.sqrt(timeData.reduce((sum, val) => sum + val * val, 0) / timeData.length);
            console.log(`🔄 Audio test ${testCount + 1}/5 - RMS: ${currentRms.toFixed(6)}, Max: ${Math.max(...timeData).toFixed(6)}`);
            
            testCount++;
            if (testCount >= 5) {
              clearInterval(continuousTest);
            }
          }, 1000);
        }, 1000);

        set({
          isRecording: true,
          audioStream: stream,
          audioContext,
          analyser,
        });
      } catch (error) {
        console.error('Failed to start recording:', error);
        throw error;
      }
    },

    stopRecording: () => {
      const { audioStream, audioContext } = get();
      
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      
      if (audioContext) {
        audioContext.close();
      }

      set({
        isRecording: false,
        audioStream: null,
        audioContext: null,
        analyser: null,
      });
    },

    updateAnalysis: (analysis: AudioAnalysis) => {
      set(state => ({
        currentAnalysis: analysis,
        analysis: analysis, // Update alias as well
        analysisHistory: [...state.analysisHistory.slice(-99), analysis], // Keep last 100
      }));
    },

    updateFeatures: (features: AudioFeatures) => {
      set({ features });
    },

    setConfig: (newConfig: Partial<AudioProcessorConfig>) => {
      set(state => ({
        config: { ...state.config, ...newConfig },
      }));
    },

    clearHistory: () => {
      set({ analysisHistory: [] });
    },
  }))
);