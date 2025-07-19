import React, { useEffect, useState, useRef } from "react";
import { useRealtimeStore } from "@/stores";
import { useAudioStore } from "@/stores/audioStore";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";
import { cn } from "@/utils";
import { Mic, MicOff, MessageSquare, Loader2 } from "lucide-react";
import { createMusicAnalyzer, formatMusicAnalysisForAI, type MusicAnalysis } from '@/utils/musicAnalyzer';
import { musicCompanion } from '@/utils/musicCompanion';

interface RealtimeChatProps {
  className?: string;
}

export function RealtimeChat({ className }: RealtimeChatProps) {
  const {
    conversation,
    error: chatError,
    clearConversation,
    sendToOpenAI,
    setError,
  } = useRealtimeStore();

  const {
    currentAnalysis,
    audioStream,
  } = useAudioStore();

  const {
    isRecording,
    isInitializing,
    initError,
    startRecording,
    stopRecording,
  } = useAudioProcessor();

  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [currentMusicAnalysis, setCurrentMusicAnalysis] = useState<MusicAnalysis | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingVoiceRef = useRef(false);

  // Voice activity detection based on the audio analysis
  useEffect(() => {
    if (!currentAnalysis || !isRecording || isProcessingVoice) {
      setIsVoiceActive(false);
      return;
    }

    // Use volume from the sophisticated audio analysis with higher threshold
    const voiceThreshold = 0.15; // Higher threshold to avoid background noise
    const isVoiceDetected = currentAnalysis.volume > voiceThreshold;

    setIsVoiceActive(isVoiceDetected);

    // Handle voice activity for recording
    if (
      isVoiceDetected &&
      !isRecordingVoiceRef.current &&
      audioStream &&
      !isProcessingVoice
    ) {
      // Start recording
      console.log("Voice detected, starting recording...");
      startVoiceRecording();
    } else if (!isVoiceDetected && isRecordingVoiceRef.current) {
      // Start silence timer
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          if (isRecordingVoiceRef.current) {
            console.log("Silence detected, stopping recording...");
            stopVoiceRecording();
          }
        }, 2000); // Stop after 2 seconds of silence
      }
    } else if (
      isVoiceDetected &&
      isRecordingVoiceRef.current &&
      silenceTimerRef.current
    ) {
      // Cancel silence timer if voice detected again
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, [currentAnalysis, isRecording, audioStream, isProcessingVoice, startRecording,]);

  const startVoiceRecording = () => {
    if (!audioStream || isRecordingVoiceRef.current) return;

    try {
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (recordingChunksRef.current.length > 0) {
          const audioBlob = new Blob(recordingChunksRef.current, {
            type: "audio/webm",
          });
          await processVoiceRecording(audioBlob);
        }
        isRecordingVoiceRef.current = false;
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      isRecordingVoiceRef.current = true;
      setCurrentTranscript("");

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } catch (error) {
      console.error("Failed to start voice recording:", error);
      setError("Failed to start voice recording");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoiceRef.current) {
      mediaRecorderRef.current.stop();
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const processVoiceRecording = async (audioBlob: Blob) => {
    // Prevent recursive calls
    if (isProcessingVoice) {
      console.log("Already processing voice, skipping...");
      return;
    }

    try {
      setIsProcessingVoice(true);
      setCurrentTranscript("Analyzing audio...");

      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        console.log("Empty audio blob, skipping...");
        setCurrentTranscript("No audio recorded");
        setTimeout(() => setCurrentTranscript(""), 2000);
        return;
      }

      // Convert blob to audio buffer for analysis
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const audioData = audioBuffer.getChannelData(0);

      // Get current audio features from the audio processor
      const features = currentAnalysis ? {
        spectralCentroid: currentAnalysis.spectralCentroid,
        spectralRolloff: currentAnalysis.spectralRolloff,
        rms: currentAnalysis.volume,
        zcr: 0.1, // Default value, would need to calculate from audioData
        mfcc: [], // Would need to extract from audioData
        chroma: [], // Would need to extract from audioData
        spectralBandwidth: 0,
        timestamp: Date.now()
      } : undefined;

      // Advanced music companion analysis
      let companionAnalysis = null;
      if (features) {
        companionAnalysis = musicCompanion.analyzePerformance(audioData, features, audioBuffer.sampleRate);
        console.log("Music Companion Analysis:", companionAnalysis);
      }

      // Basic music analysis (fallback)
      const musicAnalyzer = createMusicAnalyzer();
      const musicAnalysis = musicAnalyzer.analyzeAudio(audioData, audioBuffer.sampleRate);
      setCurrentMusicAnalysis(musicAnalysis);

      console.log("Audio analysis:", musicAnalysis);

      // Always try to transcribe first to get what the user said
      setCurrentTranscript("Processing audio...");
      
      // Convert blob to base64 for Deepgram safely for large files
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to avoid stack overflow
      let base64Audio = '';
      const chunkSize = 8192; // Process in 8KB chunks
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
      }

      // Send to Deepgram for transcription
      const response = await fetch("/api/deepgram/realtime", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audio: base64Audio }),
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("Transcription result:", data);

      // Determine what to send to AI based on advanced analysis
      let promptToSend = "";
      let displayText = "";
      
      if (companionAnalysis) {
        // Use advanced music companion analysis
        const { voice, instruments, overall } = companionAnalysis;
        
        if (voice.isVoiceDetected && data.transcript && data.transcript.trim()) {
          // Voice detected with transcript
          const voiceType = voice.isSinging ? "singing" : "speaking";
          displayText = `${voiceType}: "${data.transcript}"`;
          
          if (instruments.instruments.length > 0 && instruments.instruments[0] !== 'unknown') {
            // Voice + instruments
            displayText += ` + ${instruments.instruments.join(', ')}`;
            const musicDescription = musicCompanion.formatForAI(companionAnalysis);
            promptToSend = `I'm ${voiceType} "${data.transcript.trim()}" while playing ${instruments.instruments.join(' and ')}. Here's the musical analysis:\n${musicDescription}\n\nAs my music companion, what do you think? Give me specific feedback about my performance and any suggestions for improvement.`;
          } else {
            // Just voice
            promptToSend = `I'm ${voiceType}: "${data.transcript.trim()}". ${voice.isSinging ? `My pitch is ${voice.pitch.toFixed(1)}Hz with ${(voice.pitchStability * 100).toFixed(0)}% stability. ` : ''}What do you think?`;
          }
        } else if (instruments.instruments.length > 0 && instruments.instruments[0] !== 'unknown') {
          // Just instruments, no clear voice
          displayText = `Playing: ${instruments.instruments.join(', ')}`;
          const musicDescription = musicCompanion.formatForAI(companionAnalysis);
          promptToSend = `I'm playing ${instruments.instruments.join(' and ')}. Here's the musical analysis:\n${musicDescription}\n\nAs my music companion, what do you think about this performance? Any suggestions?`;
        } else {
          // Fallback to basic analysis
          displayText = "Audio detected";
          promptToSend = "I just played something. What do you think?";
        }
      } else {
        // Fallback to original logic if companion analysis fails
        if (musicAnalysis.isMusicDetected && musicAnalysis.confidence > 0.3) {
          const musicDescription = formatMusicAnalysisForAI(musicAnalysis);
          
          if (data.transcript && data.transcript.trim()) {
            displayText = `Voice + Music: "${data.transcript}"`;
            promptToSend = `I'm ${data.transcript.trim()} while playing music. ${musicDescription}. What do you think about this combination?`;
          } else {
            displayText = "Music detected";
            promptToSend = `I'm playing some music. ${musicDescription}. What do you think about this music? Keep it short and conversational.`;
          }
        } else if (data.transcript && data.transcript.trim()) {
          displayText = data.transcript;
          promptToSend = data.transcript.trim();
        } else {
          displayText = "No clear audio detected";
          setTimeout(() => setCurrentTranscript(""), 2000);
          return;
        }
      }

      setCurrentTranscript(displayText);

      // Send to OpenAI
      if (promptToSend) {
        sendToOpenAI(promptToSend).catch((error) => {
          console.error("OpenAI error:", error);
          setError("Failed to get AI response");
        });
      }
      
      // Clear transcript after a delay
      setTimeout(() => setCurrentTranscript(""), 3000);
    } catch (error) {
      console.error("Error processing audio:", error);
      setError("Failed to process audio");
      setCurrentTranscript("Error processing audio");
      setTimeout(() => setCurrentTranscript(""), 2000);
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      // Also stop any ongoing voice recording
      stopVoiceRecording();
    } else {
      await startRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (isRecordingVoiceRef.current && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <h3 className="font-semibold">AI Chat</h3>
          {isRecording && (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearConversation}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            disabled={conversation.length === 0}
          >
            Clear
          </button>

          <button
            onClick={handleToggleRecording}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            )}
            disabled={isInitializing}
          >
            {isInitializing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing...
              </>
            ) : isRecording ? (
              <>
                <MicOff className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {(chatError || initError) && (
        <div className="p-3 bg-red-50 border-l-4 border-red-400 text-red-700 text-sm">
          {chatError || initError}
        </div>
      )}

      {/* Compact Voice Activity Status */}
      {isRecording && (
        <div className="px-3 py-2 bg-blue-50 border-b">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {isProcessingVoice ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  <span className="text-blue-600">Analyzing...</span>
                </>
              ) : isRecordingVoiceRef.current ? (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-600">Recording</span>
                </>
              ) : isVoiceActive ? (
                <>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  <span className="text-orange-600">Audio detected</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  <span className="text-gray-600">Listening</span>
                </>
              )}

              {/* Music/Voice indicator */}
              {currentMusicAnalysis && (
                <span className="text-gray-500">
                  {currentMusicAnalysis.isMusicDetected ? (
                    <>🎵 Music ({Math.round(currentMusicAnalysis.confidence * 100)}%)</>
                  ) : (
                    <>🎤 Voice</>
                  )}
                </span>
              )}
            </div>

            {/* Audio Level */}
            {currentAnalysis && (
              <div className="flex items-center gap-1">
                <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-100",
                      currentAnalysis.volume > 0.15 ? "bg-green-500" : "bg-gray-400"
                    )}
                    style={{
                      width: `${Math.min(currentAnalysis.volume * 200, 100)}%`,
                    }}
                  />
                </div>
                <span className="text-gray-500 w-8">
                  {Math.round(currentAnalysis.volume * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Current transcript - only show when processing or has content */}
          {currentTranscript && (
            <div className="mt-1 text-xs text-gray-600 truncate">
              {isProcessingVoice ? "Processing: " : ""}
              {currentTranscript}
            </div>
          )}
        </div>
      )}

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Start a conversation</p>
            <p className="text-sm">
              {isRecording
                ? "Speak naturally and I'll respond in real-time"
                : "Click Start to begin voice chat with AI"}
            </p>
          </div>
        ) : (
          conversation.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-3 max-w-[80%]",
                message.role === "user" ? "ml-auto" : "mr-auto"
              )}
            >
              <div
                className={cn(
                  "px-4 py-2 rounded-lg text-sm",
                  message.role === "user"
                    ? "bg-blue-500 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                )}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
