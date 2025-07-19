'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/common';
import { useAvatarStore } from '@/stores/avatarStore';

interface SimpleAvatarProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const getEmotionColor = (emotion: string): string => {
  const colorMap: Record<string, string> = {
    'neutral': '#6B7280',      // Gray
    'excited': '#F59E0B',      // Amber
    'listening': '#3B82F6',    // Blue
    'thinking': '#8B5CF6',     // Purple
    'speaking': '#10B981',     // Green
    'processing': '#F97316',   // Orange
    'understanding': '#06B6D4', // Cyan
    'empathetic': '#EC4899',   // Pink
    'curious': '#84CC16',      // Lime
    'helpful': '#059669',      // Emerald
    'celebrating': '#DC2626',  // Red
    'confused': '#78716C',     // Stone
  };
  return colorMap[emotion] || colorMap['neutral'];
};

const getEmotionEmoji = (emotion: string): string => {
  const emojiMap: Record<string, string> = {
    'neutral': '😐',
    'excited': '🤩',
    'listening': '👂',
    'thinking': '🤔',
    'speaking': '💬',
    'processing': '⚡',
    'understanding': '💡',
    'empathetic': '🤗',
    'curious': '🧐',
    'helpful': '😊',
    'celebrating': '🎉',
    'confused': '😕',
  };
  return emojiMap[emotion] || emojiMap['neutral'];
};

export default function SimpleAvatar({ className, size = "lg" }: SimpleAvatarProps) {
  const { emotion, isAnimating } = useAvatarStore();
  
  const sizeClasses = {
    sm: "w-16 h-16 text-2xl",
    md: "w-24 h-24 text-4xl", 
    lg: "w-32 h-32 text-6xl",
    xl: "w-40 h-40 text-8xl",
  };

  const currentColor = getEmotionColor(emotion);
  const currentEmoji = getEmotionEmoji(emotion);

  return (
    <motion.div
      className={cn(
        "relative rounded-full flex items-center justify-center border-4 transition-all duration-500",
        sizeClasses[size],
        className
      )}
      style={{ 
        backgroundColor: `${currentColor}20`,
        borderColor: currentColor,
        boxShadow: `0 0 20px ${currentColor}40`
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isAnimating ? [1, 1.1, 1] : 1, 
        opacity: 1,
        rotate: isAnimating ? [0, 5, -5, 0] : 0
      }}
      transition={{ 
        duration: isAnimating ? 0.6 : 0.8, 
        ease: "easeOut",
        repeat: isAnimating ? Infinity : 0,
        repeatType: "reverse"
      }}
    >
      {/* Emoji face */}
      <motion.div
        animate={{ 
          scale: isAnimating ? [1, 1.2, 1] : 1,
        }}
        transition={{ 
          duration: 0.5,
          repeat: isAnimating ? Infinity : 0,
          repeatType: "reverse"
        }}
      >
        {currentEmoji}
      </motion.div>
      
      {/* Pulsing ring effect */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 opacity-30"
        style={{ borderColor: currentColor }}
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.3, 0, 0.3]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Status indicator */}
      <div className="absolute -bottom-2 -right-2">
        <motion.div
          className="w-4 h-4 rounded-full border-2 border-white"
          style={{ backgroundColor: currentColor }}
          animate={{ 
            scale: isAnimating ? [1, 1.3, 1] : 1,
          }}
          transition={{ 
            duration: 0.8,
            repeat: isAnimating ? Infinity : 0,
            repeatType: "reverse"
          }}
        />
      </div>
    </motion.div>
  );
}