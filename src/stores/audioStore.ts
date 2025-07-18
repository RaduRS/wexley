import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  AudioAnalysis,
  AudioFeatures,
  AudioProcessorConfig,
} from "@/types";

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
        zcr: true,
      },
      // sampleRate is already defined above, removing duplicate
      // bufferSize: 4096,
      // fftSize: 2048,
      // Removed hopSize as it's not defined in AudioProcessorConfig type
    },

    // Actions
    startRecording: async () => {
      try {
        // First, enumerate available audio devices
        let selectedDeviceId: string | undefined;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(
            (device) => device.kind === "audioinput"
          );

          // Look for Scarlett device
          const scarlettDevice = audioInputs.find(
            (device) =>
              device.label.toLowerCase().includes("scarlett") ||
              device.label.toLowerCase().includes("focusrite")
          );

          if (scarlettDevice) {
            selectedDeviceId = scarlettDevice.deviceId;
          }
        } catch (deviceError) {
          console.warn("⚠️ Could not enumerate devices:", deviceError);
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

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });

        const audioContext = new AudioContext({
          sampleRate: get().config.sampleRate,
        });

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = get().config.fftSize;
        analyser.smoothingTimeConstant = get().config.smoothingTimeConstant;
        analyser.minDecibels = get().config.minDecibels;
        analyser.maxDecibels = get().config.maxDecibels;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        // Test if we're getting audio data
        const testData = new Float32Array(analyser.frequencyBinCount);
        const timeData = new Float32Array(analyser.fftSize);

        setTimeout(() => {
          analyser.getFloatFrequencyData(testData);
          analyser.getFloatTimeDomainData(timeData);

          // Try a continuous test for 5 seconds
          let testCount = 0;
          const continuousTest = setInterval(() => {
            analyser.getFloatTimeDomainData(timeData);

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
        console.error("Failed to start recording:", error);
        throw error;
      }
    },

    stopRecording: () => {
      const { audioStream, audioContext } = get();

      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
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
      set((state) => ({
        currentAnalysis: analysis,
        analysis: analysis, // Update alias as well
        analysisHistory: [...state.analysisHistory.slice(-99), analysis], // Keep last 100
      }));
    },

    updateFeatures: (features: AudioFeatures) => {
      set({ features });
    },

    setConfig: (newConfig: Partial<AudioProcessorConfig>) => {
      set((state) => ({
        config: { ...state.config, ...newConfig },
      }));
    },

    clearHistory: () => {
      set({ analysisHistory: [] });
    },
  }))
);
