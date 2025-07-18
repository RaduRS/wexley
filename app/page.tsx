'use client';

import { Avatar } from '@/components/avatar';
import { AudioControls, AudioVisualizer } from '@/components/audio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useAudioStore, useAvatarStore } from '@/stores';
import { useAudioProcessor } from '@/hooks';
import { useEffect } from 'react';

export default function Home() {
  const { analysis } = useAudioStore();
  const { setEmotion, setAnimation } = useAvatarStore();
  const { isRecording } = useAudioProcessor();

  // Dynamic avatar emotion based on audio
  useEffect(() => {
    if (analysis) {
      const { volume } = analysis;
      if (volume > 50) {
        setEmotion('excited');
      } else if (volume > 20) {
        setEmotion('listening');
      } else {
        setEmotion('neutral');
      }
    }
  }, [analysis, setEmotion]);

  // Control avatar animation based on recording state
  useEffect(() => {
    if (isRecording) {
      setAnimation('dancing');
    } else {
      setAnimation('idle');
    }
  }, [isRecording, setAnimation]);

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Avatar Section */}
          <Card className="flex flex-col items-center justify-center p-8">
            <CardHeader className="text-center">
              <CardTitle>Your Musical Companion</CardTitle>
              <p className="text-sm text-gray-600">
                Click the avatar to change emotions
              </p>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              <Avatar size="xl" />
            </CardContent>
          </Card>

          {/* Audio Analysis Section */}
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
        </div>

        {/* Additional Visualizers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Waveform</CardTitle>
            </CardHeader>
            <CardContent>
              <AudioVisualizer type="waveform" color="#10b981" className="h-32" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Circular Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <AudioVisualizer type="circular" color="#f59e0b" className="h-32" />
            </CardContent>
          </Card>
        </div>

        {/* Phase 1 Status */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Phase 1: Foundation Complete ✅</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">✅ Architecture</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Clean project structure</li>
                  <li>• TypeScript types</li>
                  <li>• Separation of concerns</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">✅ Audio System</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Web Audio API integration</li>
                  <li>• Real-time processing</li>
                  <li>• Multiple visualizations</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-green-600">✅ Avatar System</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Animated character</li>
                  <li>• Emotion states</li>
                  <li>• Reactive animations</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-blue-600">🚀 Next: Phase 2</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• AI integration</li>
                  <li>• Voice commands</li>
                  <li>• Music suggestions</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
