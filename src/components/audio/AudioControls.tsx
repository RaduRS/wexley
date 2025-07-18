'use client';

import React from 'react';
import { Mic, Square, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAudioProcessor } from '@/hooks/useAudioProcessor';
import { useAudioStore } from '@/stores/audioStore';
import { cn } from '@/utils';

interface AudioControlsProps {
  className?: string;
}

export function AudioControls({ className }: AudioControlsProps) {
  const { isRecording, isInitializing, initError, startRecording, stopRecording } = useAudioProcessor();
  const { currentAnalysis } = useAudioStore();

  const handleToggleRecording = async () => {
    try {
      if (isRecording) {
        stopRecording();
      } else {
        await startRecording();
      }
    } catch (error) {
      console.error('Failed to toggle recording:', error);
      // You could add toast notification here
    }
  };

  const getButtonContent = () => {
    if (isInitializing) {
      return (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Initializing Scarlett...
        </>
      );
    }
    
    if (isRecording) {
      return (
        <>
          <Square className="w-5 h-5" />
          Stop Recording
        </>
      );
    }
    
    return (
      <>
        <Mic className="w-5 h-5" />
        Start Recording
      </>
    );
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Main controls */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleToggleRecording}
          variant={isRecording ? 'secondary' : 'primary'}
          size="lg"
          disabled={isInitializing}
          className={cn(
            'flex items-center gap-2 transition-all duration-200',
            isRecording && 'animate-pulse',
            isInitializing && 'opacity-75'
          )}
        >
          {getButtonContent()}
        </Button>

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 text-red-600">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording via Scarlett</span>
          </div>
        )}

        {/* Initialization indicator */}
        {isInitializing && (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Connecting to audio interface...</span>
          </div>
        )}
      </div>

      {/* Error display */}
      {initError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{initError}</span>
        </div>
      )}

      {/* Audio level indicator with enhanced feedback for Scarlett */}
      {currentAnalysis && isRecording && (
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 font-medium">Input Level:</span>
            <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-100 rounded-full"
                style={{
                  width: `${Math.min(100, currentAnalysis.volume * 100)}%`,
                  backgroundColor: currentAnalysis.volume > 0.8 ? '#ef4444' : 
                                  currentAnalysis.volume > 0.5 ? '#f59e0b' : '#10b981'
                }}
              />
            </div>
            <span className="text-xs text-gray-500 min-w-[3rem]">
              {Math.round(currentAnalysis.volume * 100)}%
            </span>
          </div>

          {/* Frequency indicator */}
          {currentAnalysis.pitch && currentAnalysis.pitch > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Pitch:</span>
              <span className="text-sm font-mono bg-white px-2 py-1 rounded">
                {Math.round(currentAnalysis.pitch)}Hz
              </span>
            </div>
          )}

          {/* Signal quality indicator */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Signal:</span>
            <div className={cn(
              "w-2 h-2 rounded-full",
              currentAnalysis.volume > 0.1 ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-xs text-gray-500">
              {currentAnalysis.volume > 0.1 ? "Good" : "Low"}
            </span>
          </div>
        </div>
      )}

      {/* Helpful tip for Scarlett interface */}
      {!isRecording && !isInitializing && (
        <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-200">
          💡 Make sure your Scarlett interface is connected and the input gain is properly set
        </div>
      )}
    </div>
  );
}