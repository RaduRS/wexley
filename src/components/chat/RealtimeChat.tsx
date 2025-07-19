import React, { useEffect, useState, useRef } from "react";
import { useRealtimeStore } from "@/stores";
import { useAudioStore } from "@/stores/audioStore";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";
import { cn } from "@/utils";
import { Mic, MicOff, MessageSquare, Loader2 } from "lucide-react";
import { createMusicAnalyzer, type MusicAnalysis } from '@/utils/musicAnalyzer';
import { whisperAnalyzer } from "@/services/whisperAnalyzer";
import { musicCompanion } from "@/services/musicCompanion";

interface RealtimeChatProps {
  className?: string;
}

export function RealtimeChat({ className }: RealtimeChatProps) {
  const {
    conversation,
    error: chatError,
    clearConversation,
    sendToOpenAI,
    sendToOpenAIWithCustomDisplay,
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
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when conversation updates (only within chat container)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversation]);
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
        }, 4000); // Stop after 4 seconds of silence
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
    if (!audioBlob || audioBlob.size === 0) {
      console.warn("Empty audio blob received");
      return;
    }

    setIsProcessingVoice(true);
    setError("");

    try {
      // Create separate ArrayBuffers for different operations to avoid detachment
      const arrayBufferForAudio = await audioBlob.arrayBuffer();
      const arrayBufferForWhisper = await audioBlob.arrayBuffer();
      const arrayBufferForDeepgram = await audioBlob.arrayBuffer();
      
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBufferForAudio);
      const audioData = audioBuffer.getChannelData(0);

      console.log("Processing audio blob:", {
        size: audioBlob.size,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
      });

      setCurrentTranscript("Analyzing audio...");

      // Step 1: Quick analysis to determine if it's primarily speech or music
      const musicAnalyzer = createMusicAnalyzer();
      const quickAnalysis = musicAnalyzer.analyzeAudio(audioData, audioBuffer.sampleRate);
      
      console.log("Quick analysis:", quickAnalysis);

      // Step 2: Decide which service to use based on content type
      let promptToSend = "";
      let displayText = "";

      // IMPROVED LOGIC: Prioritize music detection when both music and singing are present
      // This handles cases like guitar + vocals which should go to music analysis
      if (quickAnalysis.isMusicDetected && quickAnalysis.confidence > 0.2) {
        // MUSIC PATH: Try Whisper for musical content + Creative Companion, with fallback
        console.log("Detected music - trying Whisper + Creative Companion");
        
        let whisperSuccess = false;
        
        try {
          const whisperResult = await whisperAnalyzer.analyzeAudio(arrayBufferForWhisper);
          
          if (whisperResult && whisperResult.music) {
            console.log("Whisper music analysis successful:", whisperResult);
            
            // Create enhanced display text
            displayText = `🎵 Music Analysis: ${whisperResult.music.instruments.join(', ')} | ${whisperResult.music.genre} | ${whisperResult.music.tempo} | ${whisperResult.music.mood}`;
            
            // Generate creative companion prompt
            const creativePrompt = musicCompanion.generateContextualPrompt(whisperResult.music, true);
            promptToSend = creativePrompt;
            
            setCurrentMusicAnalysis({
              ...quickAnalysis,
              instruments: whisperResult.music.instruments,
              genre: whisperResult.music.genre,
              mood: whisperResult.music.mood,
              confidence: whisperResult.music.confidence
            });
            
            whisperSuccess = true;
          }
        } catch (error) {
          console.warn("Whisper API failed, using basic music detection:", error);
        }
        
        // If Whisper failed, use basic music detection with simple prompt
         if (!whisperSuccess) {
           displayText = "🎵 Music detected";
           // Use the simplest possible prompt to avoid long responses
           promptToSend = musicCompanion.generateSimplePrompt(true);
         }

      } else if ((quickAnalysis.isVoice || quickAnalysis.isSinging) && !quickAnalysis.isMusicDetected) {
        // SPEECH PATH: Use Deepgram + OpenAI for voice/speech content (only when no music detected)
        console.log("Detected speech/voice without music - using Deepgram");
        
        // Convert blob to base64 for Deepgram using dedicated ArrayBuffer
        const uint8Array = new Uint8Array(arrayBufferForDeepgram);
        let base64Audio = '';
        const chunkSize = 8192;
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
        }

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
        console.log("Deepgram transcription:", data);

        if (data.transcript && data.transcript.trim()) {
          const voiceType = quickAnalysis.isSinging ? "singing" : "speaking";
          displayText = `${voiceType}: "${data.transcript}"`;
          promptToSend = data.transcript.trim();
        } else {
          displayText = "Voice detected but unclear";
          promptToSend = "I said something but it wasn't clear. Can you respond anyway?";
        }

      } else {
        // UNCLEAR AUDIO: Try both approaches
        console.log("Unclear audio - trying both approaches");
        
        // Try Deepgram first for potential speech using dedicated ArrayBuffer
        const uint8Array = new Uint8Array(arrayBufferForDeepgram);
        let base64Audio = '';
        const chunkSize = 8192;
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
        }

        try {
          const response = await fetch("/api/deepgram/realtime", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ audio: base64Audio }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.transcript && data.transcript.trim()) {
              displayText = data.transcript;
              promptToSend = data.transcript.trim();
            }
          }
        } catch (error) {
          console.warn("Deepgram failed for unclear audio:", error);
        }

        // If no clear speech, fall back to generic response
        if (!promptToSend) {
          displayText = "Audio detected";
          promptToSend = "I made some sound. What do you think?";
        }
      }

      setCurrentTranscript(displayText);

      // Send to OpenAI with appropriate user message display
      if (promptToSend) {
        // For music analysis, show a user-friendly message instead of the internal prompt
        const userDisplayText = quickAnalysis.isMusicDetected && quickAnalysis.confidence > 0.2 
          ? displayText // Use the music analysis display text
          : displayText; // Use the actual transcript for speech
        
        sendToOpenAIWithCustomDisplay(promptToSend, userDisplayText).catch((error) => {
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

  // Helper function to format AI responses for better display
  const formatAIResponse = (content: string) => {
    try {
      // Try to parse as JSON first (for creative suggestions)
      const parsed = JSON.parse(content);
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        return (
          <div className="space-y-3">
            <div className="font-medium text-purple-700 flex items-center gap-2">
              🎵 Creative Suggestions
            </div>
            
            {parsed.suggestions.map((suggestion: {
              instrument: string;
              type: string;
              style: string;
              description: string;
              reasoning: string;
            }, idx: number) => (
              <div key={idx} className="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-400">
                <div className="font-medium text-purple-800 mb-1">
                  {idx + 1}. {suggestion.instrument} ({suggestion.type})
                </div>
                <div className="text-sm text-purple-700 mb-1">
                  <strong>Style:</strong> {suggestion.style}
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  {suggestion.description}
                </div>
                <div className="text-xs text-purple-600 italic">
                  💡 {suggestion.reasoning}
                </div>
              </div>
            ))}
            
            {parsed.overall_feedback && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="font-medium text-blue-800 mb-1">Overall Feedback:</div>
                <div className="text-sm text-blue-700">{parsed.overall_feedback}</div>
              </div>
            )}
            
            {parsed.next_steps && parsed.next_steps.length > 0 && (
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="font-medium text-green-800 mb-2">Next Steps:</div>
                <ul className="text-sm text-green-700 space-y-1">
                  {parsed.next_steps.map((step: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }
    } catch (error) {
      // Not JSON or not a creative response, fall back to regular text
    }
    
    // Regular text response
    return <span>{content}</span>;
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
          <h3 className="font-semibold">Music Companion</h3>
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
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Start jamming with your AI companion</p>
            <p className="text-sm">
              {isRecording
                ? "Play music or speak - I'll give you creative suggestions in real-time"
                : "Click Start to begin your music collaboration session"}
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
                {message.role === "assistant" ? formatAIResponse(message.content) : message.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
