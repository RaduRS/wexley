"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { motion } from "framer-motion";
import * as THREE from "three";
import { useAvatarStore } from "@/stores";
import { cn } from "@/utils";

interface Avatar3DProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

// Sophisticated character head with realistic features
function CharacterHead({ emotion, isAnimating }: { emotion: string; isAnimating: boolean }) {
  const headRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Group>(null);
  const upperLipRef = useRef<THREE.Mesh>(null);
  const lowerLipRef = useRef<THREE.Mesh>(null);
  const leftEyebrowRef = useRef<THREE.Mesh>(null);
  const rightEyebrowRef = useRef<THREE.Mesh>(null);
  const leftEarRef = useRef<THREE.Mesh>(null);
  const rightEarRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!headRef.current) return;

    const t = state.clock.getElapsedTime();

    if (isAnimating) {
      // Head animations based on emotion
      switch (emotion) {
        case "excited":
          headRef.current.rotation.z = Math.sin(t * 6) * 0.05;
          headRef.current.position.y = Math.sin(t * 8) * 0.02;
          break;

        case "celebrating":
          headRef.current.rotation.z = Math.sin(t * 8) * 0.1;
          headRef.current.position.y = Math.abs(Math.sin(t * 10)) * 0.05;
          break;

        case "thinking":
          headRef.current.rotation.x = Math.sin(t * 0.8) * 0.03;
          headRef.current.rotation.y = Math.sin(t * 0.5) * 0.02;
          break;

        case "processing":
          headRef.current.rotation.y = Math.sin(t * 1.5) * 0.04;
          break;

        case "speaking":
          // Realistic mouth movement for speaking
          if (upperLipRef.current && lowerLipRef.current) {
            const mouthOpen = Math.abs(Math.sin(t * 12)) * 0.3;
            upperLipRef.current.position.y = 0.02 + mouthOpen * 0.5;
            lowerLipRef.current.position.y = -0.02 - mouthOpen * 0.5;
            upperLipRef.current.scale.y = 1 + mouthOpen * 0.2;
            lowerLipRef.current.scale.y = 1 + mouthOpen * 0.2;
          }
          break;

        case "listening":
          headRef.current.rotation.z = Math.sin(t * 1.2) * 0.02;
          // Subtle ear movement
          if (leftEarRef.current && rightEarRef.current) {
            leftEarRef.current.rotation.z = Math.sin(t * 2) * 0.05;
            rightEarRef.current.rotation.z = Math.sin(t * 2 + Math.PI) * 0.05;
          }
          break;

        default:
          // Gentle breathing
          headRef.current.position.y = Math.sin(t * 1.5) * 0.005;
          headRef.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.002);
      }
    }

    // Eyebrow animations based on emotion
    if (leftEyebrowRef.current && rightEyebrowRef.current) {
      switch (emotion) {
        case "thinking":
          leftEyebrowRef.current.rotation.z = 0.1;
          rightEyebrowRef.current.rotation.z = -0.05;
          break;
        case "concerned":
          leftEyebrowRef.current.rotation.z = 0.15;
          rightEyebrowRef.current.rotation.z = -0.15;
          leftEyebrowRef.current.position.y = 0.02;
          rightEyebrowRef.current.position.y = 0.02;
          break;
        case "excited":
        case "celebrating":
          leftEyebrowRef.current.position.y = 0.01;
          rightEyebrowRef.current.position.y = 0.01;
          break;
        default:
          leftEyebrowRef.current.rotation.z = 0;
          rightEyebrowRef.current.rotation.z = 0;
          leftEyebrowRef.current.position.y = 0;
          rightEyebrowRef.current.position.y = 0;
      }
    }
  });

  // Get skin color based on emotion
  const getSkinColor = () => {
    switch (emotion) {
      case "excited": return "#FFE4B5"; // Warm peach
      case "celebrating": return "#FFCCCB"; // Light pink
      case "thinking": return "#E6E6FA"; // Lavender
      case "processing": return "#E0FFFF"; // Light cyan
      case "speaking": return "#F0E68C"; // Khaki
      case "listening": return "#E0F6FF"; // Alice blue
      case "concerned": return "#FFF8DC"; // Cornsilk
      case "helpful": return "#F0FFF0"; // Honeydew
      default: return "#FFEFD5"; // Papaya whip
    }
  };

  // Get eye expression
  const getEyeExpression = () => {
    switch (emotion) {
      case "excited":
      case "celebrating":
        return { scaleY: 0.7, scaleX: 1.1, pupilScale: 1.2 }; // Happy squint
      case "thinking":
        return { scaleY: 1.2, scaleX: 0.9, pupilScale: 0.8 }; // Focused
      case "processing":
        return { scaleY: 1.3, scaleX: 1.1, pupilScale: 1.1 }; // Wide alert
      case "concerned":
        return { scaleY: 1.1, scaleX: 0.9, pupilScale: 0.9 }; // Worried
      case "listening":
        return { scaleY: 1.05, scaleX: 1, pupilScale: 1 }; // Attentive
      default:
        return { scaleY: 1, scaleX: 1, pupilScale: 1 }; // Normal
    }
  };

  // Get mouth expression
  const getMouthExpression = () => {
    switch (emotion) {
      case "excited":
      case "celebrating":
      case "helpful":
        return { 
          upperLipY: 0.03, 
          lowerLipY: -0.03, 
          scaleX: 1.3, 
          scaleY: 0.8,
          cornerCurve: 0.02 
        }; // Smile
      case "thinking":
        return { 
          upperLipY: 0.01, 
          lowerLipY: -0.01, 
          scaleX: 0.9, 
          scaleY: 0.7,
          cornerCurve: 0 
        }; // Small mouth
      case "concerned":
        return { 
          upperLipY: 0.01, 
          lowerLipY: -0.02, 
          scaleX: 1, 
          scaleY: 0.6,
          cornerCurve: -0.01 
        }; // Slight frown
      case "processing":
        return { 
          upperLipY: 0.005, 
          lowerLipY: -0.005, 
          scaleX: 1, 
          scaleY: 0.5,
          cornerCurve: 0 
        }; // Neutral line
      default:
        return { 
          upperLipY: 0.02, 
          lowerLipY: -0.02, 
          scaleX: 1.1, 
          scaleY: 0.8,
          cornerCurve: 0.005 
        }; // Slight smile
    }
  };

  const eyeExpression = getEyeExpression();
  const mouthExpression = getMouthExpression();

  return (
    <group ref={headRef}>
      {/* Main Head - More realistic oval shape */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={getSkinColor()}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Forehead definition */}
      <mesh position={[0, 0.3, 0.7]} scale={[0.8, 0.4, 0.3]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={getSkinColor()}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Cheekbones */}
      <mesh position={[-0.4, -0.1, 0.6]} scale={[0.3, 0.3, 0.2]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={getSkinColor()}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0.4, -0.1, 0.6]} scale={[0.3, 0.3, 0.2]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={getSkinColor()}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Jaw definition */}
      <mesh position={[0, -0.5, 0.3]} scale={[0.7, 0.3, 0.4]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={getSkinColor()}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Left Eye Socket */}
      <group ref={leftEyeRef} position={[-0.25, 0.15, 0.8]}>
        {/* Eye white */}
        <mesh scale={[eyeExpression.scaleX, eyeExpression.scaleY, 1]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
        </mesh>
        {/* Iris */}
        <mesh position={[0, 0, 0.08]} scale={[0.7, 0.7, 1]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#4A90E2" roughness={0.2} />
        </mesh>
        {/* Pupil */}
        <mesh position={[0, 0, 0.12]} scale={[eyeExpression.pupilScale, eyeExpression.pupilScale, 1]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        {/* Eye highlight */}
        <mesh position={[0.02, 0.02, 0.15]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Right Eye Socket */}
      <group ref={rightEyeRef} position={[0.25, 0.15, 0.8]}>
        {/* Eye white */}
        <mesh scale={[eyeExpression.scaleX, eyeExpression.scaleY, 1]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
        </mesh>
        {/* Iris */}
        <mesh position={[0, 0, 0.08]} scale={[0.7, 0.7, 1]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#4A90E2" roughness={0.2} />
        </mesh>
        {/* Pupil */}
        <mesh position={[0, 0, 0.12]} scale={[eyeExpression.pupilScale, eyeExpression.pupilScale, 1]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        {/* Eye highlight */}
        <mesh position={[-0.02, 0.02, 0.15]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Eyebrows */}
      <mesh ref={leftEyebrowRef} position={[-0.25, 0.35, 0.85]} scale={[0.3, 0.05, 0.1]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} />
      </mesh>
      <mesh ref={rightEyebrowRef} position={[0.25, 0.35, 0.85]} scale={[0.3, 0.05, 0.1]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 0, 0.9]} scale={[0.15, 0.2, 0.3]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color={getSkinColor()}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Nostrils */}
      <mesh position={[-0.05, -0.05, 0.95]} scale={[0.03, 0.02, 0.05]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.9} />
      </mesh>
      <mesh position={[0.05, -0.05, 0.95]} scale={[0.03, 0.02, 0.05]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.9} />
      </mesh>

      {/* Realistic Mouth */}
      <group ref={mouthRef} position={[0, -0.3, 0.8]}>
        {/* Upper Lip */}
        <mesh 
          ref={upperLipRef}
          position={[0, mouthExpression.upperLipY, 0]}
          scale={[mouthExpression.scaleX, mouthExpression.scaleY, 0.3]}
        >
          <sphereGeometry args={[0.08, 12, 8]} />
          <meshStandardMaterial color="#CD5C5C" roughness={0.3} metalness={0.1} />
        </mesh>
        
        {/* Lower Lip */}
        <mesh 
          ref={lowerLipRef}
          position={[0, mouthExpression.lowerLipY, 0]}
          scale={[mouthExpression.scaleX, mouthExpression.scaleY * 1.2, 0.3]}
        >
          <sphereGeometry args={[0.08, 12, 8]} />
          <meshStandardMaterial color="#CD5C5C" roughness={0.3} metalness={0.1} />
        </mesh>

        {/* Mouth corners for smile/frown */}
        <mesh position={[-0.08 * mouthExpression.scaleX, mouthExpression.cornerCurve, 0]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#CD5C5C" roughness={0.3} />
        </mesh>
        <mesh position={[0.08 * mouthExpression.scaleX, mouthExpression.cornerCurve, 0]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#CD5C5C" roughness={0.3} />
        </mesh>

        {/* Teeth (visible when speaking) */}
        {emotion === "speaking" && (
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.12, 0.03, 0.02]} />
            <meshStandardMaterial color="#FFFAF0" roughness={0.1} />
          </mesh>
        )}
      </group>

      {/* Ears */}
      <mesh ref={leftEarRef} position={[-0.9, 0, 0.2]} rotation={[0, -0.3, 0]} scale={[0.3, 0.4, 0.2]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color={getSkinColor()}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>
      <mesh ref={rightEarRef} position={[0.9, 0, 0.2]} rotation={[0, 0.3, 0]} scale={[0.3, 0.4, 0.2]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color={getSkinColor()}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Hair */}
      <mesh position={[0, 0.7, 0]} scale={[1.1, 0.4, 1]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#8B4513" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Hair strands */}
      <mesh position={[-0.3, 0.9, 0.3]} rotation={[0, 0, -0.2]} scale={[0.1, 0.3, 0.1]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.9} />
      </mesh>
      <mesh position={[0.3, 0.9, 0.3]} rotation={[0, 0, 0.2]} scale={[0.1, 0.3, 0.1]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1, 0.5]} rotation={[0.3, 0, 0]} scale={[0.1, 0.3, 0.1]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#8B4513" roughness={0.9} />
      </mesh>
    </group>
  );
}

// Subtle particle effects for emotions
function EmotionEffects({ emotion }: { emotion: string }) {
  const effectsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!effectsRef.current) return;
    const t = state.clock.getElapsedTime();
    
    if (emotion === "celebrating") {
      effectsRef.current.rotation.y = t * 0.5;
    } else if (emotion === "thinking") {
      effectsRef.current.position.y = Math.sin(t * 2) * 0.02;
    }
  });

  const shouldShowEffects = ["excited", "celebrating", "helpful"].includes(emotion);
  
  if (!shouldShowEffects) return null;

  const getEffectColor = () => {
    switch (emotion) {
      case "celebrating": return "#FFD700";
      case "excited": return "#FF6B35";
      case "helpful": return "#00FF7F";
      default: return "#FFD700";
    }
  };

  return (
    <group ref={effectsRef}>
      {/* Subtle sparkles around head */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 1.5;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle * 0.5) * 0.5,
              Math.sin(angle) * radius
            ]}
          >
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial
              color={getEffectColor()}
              emissive={getEffectColor()}
              emissiveIntensity={0.5}
              transparent
              opacity={0.7}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// Main 3D Scene
function Scene() {
  const { emotion, isAnimating } = useAvatarStore();

  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[3, 3, 3]} intensity={1.2} color="#FFFFFF" />
      <pointLight position={[-3, 1, 2]} intensity={0.8} color="#FFE4B5" />
      <spotLight 
        position={[0, 5, 2]} 
        angle={0.4} 
        penumbra={1} 
        intensity={0.6}
        castShadow
      />
      
      <CharacterHead emotion={emotion} isAnimating={isAnimating} />
      <EmotionEffects emotion={emotion} />
      
      <Environment preset="studio" />
    </>
  );
}

export default function Avatar3D({ className, size = "lg" }: Avatar3DProps) {
  const sizeClasses = {
    sm: "w-32 h-32",
    md: "w-48 h-48", 
    lg: "w-64 h-64",
    xl: "w-80 h-80",
  };

  return (
    <motion.div
      className={cn(
        "relative rounded-full overflow-hidden bg-gradient-to-br from-slate-50/30 to-slate-100/30 backdrop-blur-sm border border-slate-200/20",
        sizeClasses[size],
        className
      )}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        shadows
      >
        <Scene />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
    </motion.div>
  );
}
