"use client";

import { useEffect, useState } from "react";
import { SimpleAvatar } from "@/components/avatar";
import { AudioControls } from "@/components/audio";
import { AudioVisualizer } from "@/components/audio/AudioVisualizer";
import { RealtimeChat } from "@/components/chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useAudioStore } from "@/stores/audioStore";
import { useAvatarStore } from "@/stores/avatarStore";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";

export default function Home() {
  const { emotion, isAnimating, startAnimation, setEmotion, setAnimation } = useAvatarStore();
  const { isRecording, analysis } = useAudioStore();

  // Dynamic avatar emotion based on audio - less aggressive, more natural
  useEffect(() => {
    if (analysis && isRecording) {
      const { volume } = analysis;
      // Only change emotions for significant volume changes during recording
      if (volume > 70) {
        setEmotion("excited");
        startAnimation();
      } else if (volume > 30) {
        setEmotion("listening");
        startAnimation();
      }
      // Don't force neutral during recording - let the avatar stay engaged
    }
  }, [analysis, setEmotion, startAnimation, isRecording]);

  // Control avatar animation based on recording state
  useEffect(() => {
    if (isRecording) {
      setEmotion("listening");
      setAnimation("dancing");
      startAnimation();
    } else {
      // When stopping recording, transition to neutral more naturally
      // The debouncing system will handle the timing
      setEmotion("neutral");
      setAnimation("dancing");
    }
  }, [isRecording, setAnimation, setEmotion, startAnimation]);

  const handleAvatarClick = () => {
    // Just trigger a small animation, don't change emotion
    startAnimation();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Wexly - Your AI Musical Companion
          </h1>
          <p className="text-lg text-gray-600">
            Real-time music analysis and intelligent suggestions
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Avatar Section */}
          <Card className="flex flex-col items-center justify-center p-8">
            <CardHeader className="text-center">
              <CardTitle>Your AI Companion</CardTitle>
              <p className="text-sm text-gray-600 mb-4">
                Interactive avatar that responds to conversations and audio
              </p>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center h-full w-full">
              <div
                onClick={handleAvatarClick}
                className="cursor-pointer transition-all duration-300 hover:scale-105 flex items-center justify-center"
              >
                <SimpleAvatar size="xl" />
              </div>
            </CardContent>
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                Current emotion:{" "}
                <span className="font-semibold text-blue-600">{emotion}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Click the orb to spin it!
              </p>
            </div>
          </Card>

          {/* Real-time Chat Section */}
          <Card className="lg:col-span-2">
            <CardContent className="h-96">
              <RealtimeChat className="h-full" />
            </CardContent>
          </Card>
        </div>

        {/* Audio Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Audio Analysis</CardTitle>
              <p className="text-sm text-gray-600">
                Real-time music analysis and visualization
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Audio Controls */}
              <AudioControls />

              {/* Audio Visualizer */}
              <AudioVisualizer type="frequency" className="h-48" />

              {/* Analysis Data */}
              {analysis && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Volume:</span>
                      <span className="font-medium">
                        {Math.round(analysis.volume)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Key:</span>
                      <span className="font-medium">{analysis.key}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tempo:</span>
                      <span className="font-medium">{analysis.tempo} BPM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pitch:</span>
                      <span className="font-medium">
                        {Math.round(analysis.pitch)} Hz
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Waveform Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Waveform</CardTitle>
            </CardHeader>
            <CardContent>
              <AudioVisualizer
                type="waveform"
                color="#10b981"
                className="h-32"
              />
            </CardContent>
          </Card>
        </div>

        {/* Phase 2 Status */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Phase 2: Real-time AI Integration ✅</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">✅ Foundation</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Clean project structure</li>
                  <li>• TypeScript types</li>
                  <li>• Audio system</li>
                  <li>• Avatar system</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">
                  ✅ Real-time Transcription
                </h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Deepgram WebSocket integration</li>
                  <li>• Live audio streaming</li>
                  <li>• Voice activity detection</li>
                  <li>• Real-time transcript display</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">
                  ✅ AI Chat System
                </h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• OpenAI GPT-4o-mini integration</li>
                  <li>• Streaming responses</li>
                  <li>• Conversation management</li>
                  <li>• Auto-send on speech end</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-blue-600">🚀 Next: Phase 3</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Music-specific AI prompts</li>
                  <li>• Audio analysis integration</li>
                  <li>• Smart suggestions</li>
                  <li>• Enhanced avatar reactions</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
