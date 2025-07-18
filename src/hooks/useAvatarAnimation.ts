import { useEffect, useRef } from 'react';
import { useAvatarStore } from '@/stores';

export function useAvatarAnimation() {
  const animationRef = useRef<number>(0);
  const { emotion, isAnimating, currentAnimation, config } = useAvatarStore();

  useEffect(() => {
    if (isAnimating) {
      const animate = () => {
        // Animation logic will be implemented when we create the avatar component
        // For now, just keep the animation loop running
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, currentAnimation, config.animationSpeed]);

  return {
    emotion,
    isAnimating,
    currentAnimation,
    config,
  };
}