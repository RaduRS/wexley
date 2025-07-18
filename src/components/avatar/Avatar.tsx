'use client';

import { motion } from 'framer-motion';
import { useAvatarStore } from '@/stores';
import { useAvatarAnimation } from '@/hooks';
import { cn } from '@/utils';

interface AvatarProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Avatar({ className, size = 'lg' }: AvatarProps) {
  const { setEmotion } = useAvatarStore();
  const { emotion, isAnimating, currentAnimation } = useAvatarAnimation();

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  };

  const emotionColors = {
    neutral: 'from-gray-400 to-gray-600',
    excited: 'from-yellow-400 to-orange-500',
    listening: 'from-blue-400 to-blue-600',
    thinking: 'from-purple-400 to-purple-600',
    dancing: 'from-pink-400 to-red-500',
    suggesting: 'from-green-400 to-green-600',
  };

  const animations = {
    idle: {
      scale: [1, 1.05, 1],
      rotate: [0, 2, -2, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
    listening: {
      scale: [1, 1.1, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
    dancing: {
      scale: [1, 1.2, 0.9, 1.1, 1],
      rotate: [0, 10, -10, 5, 0],
      transition: {
        duration: 0.8,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
    excited: {
      scale: [1, 1.3, 1],
      y: [0, -10, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
    thinking: {
      rotate: [0, 5, -5, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
    suggesting: {
      scale: [1, 1.15, 1],
      rotate: [0, 3, -3, 0],
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <motion.div
        className={cn(
          'rounded-full bg-gradient-to-br shadow-lg cursor-pointer',
          sizeClasses[size],
          emotionColors[emotion]
        )}
        animate={isAnimating ? animations[currentAnimation as keyof typeof animations] || animations.idle : {}}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          // Cycle through emotions for demo
          const emotions: Array<typeof emotion> = ['neutral', 'excited', 'listening', 'thinking', 'dancing', 'suggesting'];
          const currentIndex = emotions.indexOf(emotion);
          const nextEmotion = emotions[(currentIndex + 1) % emotions.length];
          setEmotion(nextEmotion);
        }}
      >
        {/* Avatar Face */}
        <div className="w-full h-full flex items-center justify-center text-white">
          <motion.div
            className="text-2xl"
            animate={{
              scale: emotion === 'excited' ? [1, 1.2, 1] : 1,
            }}
            transition={{
              duration: 0.3,
              repeat: emotion === 'excited' ? Infinity : 0,
            }}
          >
            {emotion === 'neutral' && '😊'}
            {emotion === 'excited' && '🤩'}
            {emotion === 'listening' && '👂'}
            {emotion === 'thinking' && '🤔'}
            {emotion === 'dancing' && '💃'}
            {emotion === 'suggesting' && '💡'}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}