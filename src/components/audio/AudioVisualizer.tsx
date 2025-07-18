'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAudioStore } from '@/stores';
import { cn } from '@/utils';

interface AudioVisualizerProps {
  className?: string;
  type?: 'waveform' | 'frequency' | 'circular';
  color?: string;
}

export function AudioVisualizer({ 
  className, 
  type = 'waveform',
  color = '#3b82f6'
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const { analyser, isRecording, currentAnalysis } = useAudioStore();

  useEffect(() => {
    if (!isRecording || !analyser || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;

      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (type === 'waveform') {
        drawWaveform(ctx, dataArray, canvas.width, canvas.height, color);
      } else if (type === 'frequency') {
        drawFrequency(ctx, dataArray, canvas.width, canvas.height, color);
      } else if (type === 'circular') {
        drawCircular(ctx, dataArray, canvas.width, canvas.height, color);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, analyser, type, color]);

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="w-full h-full rounded-lg bg-black/5"
      />
      
      {/* Audio info overlay */}
      {currentAnalysis && (
        <motion.div
          className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div>Volume: {Math.round(currentAnalysis.volume * 100)}%</div>
          <div>Key: {currentAnalysis.key}</div>
          <div>Tempo: {currentAnalysis.tempo} BPM</div>
        </motion.div>
      )}
    </div>
  );
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  width: number,
  height: number,
  color: string
) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.beginPath();

  const sliceWidth = width / dataArray.length;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * height) / 2;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function drawFrequency(
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  width: number,
  height: number,
  color: string
) {
  const barWidth = width / dataArray.length;
  
  ctx.fillStyle = color;
  
  for (let i = 0; i < dataArray.length; i++) {
    const barHeight = (dataArray[i] / 255) * height;
    const x = i * barWidth;
    const y = height - barHeight;
    
    ctx.fillRect(x, y, barWidth - 1, barHeight);
  }
}

function drawCircular(
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  width: number,
  height: number,
  color: string
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 4;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  
  for (let i = 0; i < dataArray.length; i++) {
    const angle = (i / dataArray.length) * Math.PI * 2;
    const amplitude = (dataArray[i] / 255) * radius;
    
    const x1 = centerX + Math.cos(angle) * radius;
    const y1 = centerY + Math.sin(angle) * radius;
    const x2 = centerX + Math.cos(angle) * (radius + amplitude);
    const y2 = centerY + Math.sin(angle) * (radius + amplitude);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}