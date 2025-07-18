import React, { useEffect, useState, useRef } from "react";
import { useRealtimeStore } from "@/stores";
import { useAudioStore } from "@/stores/audioStore";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";
import { cn } from "@/utils";
import { Mic, MicOff, MessageSquare, Loader2, Volume2 } from "lucide-react";

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
      setCurrentTranscript("Processing...");

      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        console.log("Empty audio blob, skipping...");
        setCurrentTranscript("No audio recorded");
        setTimeout(() => setCurrentTranscript(""), 2000);
        return;
      }

      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );

      // Send to Deepgram
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

      if (data.transcript && data.transcript.trim()) {
        setCurrentTranscript(data.transcript);
        // Send to OpenAI - but don't await to prevent blocking
        sendToOpenAI(data.transcript).catch((error) => {
          console.error("OpenAI error:", error);
          setError("Failed to get AI response");
        });
        // Clear transcript after a delay
        setTimeout(() => setCurrentTranscript(""), 3000);
      } else {
        setCurrentTranscript("No speech detected");
        setTimeout(() => setCurrentTranscript(""), 2000);
      }
    } catch (error) {
      console.error("Error processing voice:", error);
      setError("Failed to process voice");
      setCurrentTranscript("Error processing voice");
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

      {/* Voice Activity Status */}
      {isRecording && (
        <div className="p-3 bg-blue-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {isProcessingVoice ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-blue-600">Processing speech...</span>
                </>
              ) : isRecordingVoiceRef.current ? (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-600 font-medium">
                    Recording speech...
                  </span>
                </>
              ) : isVoiceActive ? (
                <>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  <span className="text-orange-600">Voice detected...</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  <span className="text-gray-600">Listening...</span>
                </>
              )}
            </div>

            {/* Audio Level Indicator */}
            {currentAnalysis && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Volume2 className="w-3 h-3" />
                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-100",
                      currentAnalysis.volume > 0.15
                        ? "bg-green-500"
                        : "bg-gray-400"
                    )}
                    style={{
                      width: `${Math.min(currentAnalysis.volume * 200, 100)}%`,
                    }}
                  />
                </div>
                <span className="w-12 text-right">
                  {Math.round(currentAnalysis.volume * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Current transcript */}
          {currentTranscript && (
            <div className="mt-2 p-2 bg-white rounded border text-sm">
              <span className="text-gray-500">
                {isProcessingVoice ? "Processing: " : "Transcribed: "}
              </span>
              <span className="text-gray-800">{currentTranscript}</span>
            </div>
          )}

          {/* Debug info */}
          {currentAnalysis && (
            <div className="mt-2 text-xs text-gray-500">
              Threshold: 15% | Current:{" "}
              {Math.round(currentAnalysis.volume * 100)}% |
              {currentAnalysis.volume > 0.15
                ? " 🎤 Voice detected"
                : " 🔇 Below threshold"}
              {isProcessingVoice && " | ⚙️ Processing..."}
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
