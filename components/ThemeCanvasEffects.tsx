import React, { useEffect, useRef } from 'react';
import { EffectType, EffectIntensity } from '../types';

interface ThemeCanvasEffectsProps {
  effectType: EffectType;
  intensity?: EffectIntensity;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  color?: string;
  char?: string;
}

export const ThemeCanvasEffects: React.FC<ThemeCanvasEffectsProps> = ({
  effectType,
  intensity = 'STANDARD'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (effectType === 'NONE') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle count by intensity
    let count = 25;
    if (intensity === 'MINIMAL_OFFICE') count = 12;
    if (intensity === 'CELEBRATION') count = 45;

    // Initialize particles based on effectType
    const createParticle = (): Particle => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height - canvas.height;

      switch (effectType) {
        case 'PEACH_BLOSSOM': // Hoa Đào Rơi
          return {
            x,
            y,
            size: 6 + Math.random() * 8,
            speedX: -0.5 + Math.random() * 1,
            speedY: 1 + Math.random() * 1.8,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.04,
            opacity: 0.7 + Math.random() * 0.3,
            color: '#f472b6' // Pink-400
          };

        case 'APRICOT_BLOSSOM': // Hoa Mai Rơi
          return {
            x,
            y,
            size: 6 + Math.random() * 8,
            speedX: -0.5 + Math.random() * 1,
            speedY: 1 + Math.random() * 1.8,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.04,
            opacity: 0.7 + Math.random() * 0.3,
            color: '#facc15' // Yellow-400
          };

        case 'SNOW': // Tuyết Rơi
          return {
            x,
            y,
            size: 2 + Math.random() * 4,
            speedX: -0.3 + Math.random() * 0.6,
            speedY: 0.8 + Math.random() * 1.5,
            rotation: 0,
            rotationSpeed: 0,
            opacity: 0.6 + Math.random() * 0.4,
            color: '#ffffff'
          };

        case 'RED_FLAGS': // Cờ Đỏ Sao Vàng nhỏ bay nhẹ
          return {
            x,
            y,
            size: 14 + Math.random() * 8,
            speedX: 0.2 + Math.random() * 0.8,
            speedY: 0.5 + Math.random() * 1.2,
            rotation: Math.random() * 0.4 - 0.2,
            rotationSpeed: (Math.random() - 0.5) * 0.02,
            opacity: 0.8,
            char: '🇻🇳'
          };

        case 'LANTERNS': // Lồng Đèn Đung Đưa
          return {
            x,
            y,
            size: 18 + Math.random() * 10,
            speedX: (Math.random() - 0.5) * 0.4,
            speedY: 0.4 + Math.random() * 0.8,
            rotation: Math.random() * 0.2 - 0.1,
            rotationSpeed: (Math.random() - 0.5) * 0.01,
            opacity: 0.85,
            char: '🏮'
          };

        case 'FIREWORKS': // Pháo hoa / Kim tuyến
          return {
            x,
            y,
            size: 4 + Math.random() * 6,
            speedX: -1 + Math.random() * 2,
            speedY: 1.2 + Math.random() * 2.5,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1,
            opacity: 0.8,
            color: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'][Math.floor(Math.random() * 5)]
          };

        default:
          return {
            x,
            y,
            size: 5,
            speedX: 0,
            speedY: 1,
            rotation: 0,
            rotationSpeed: 0,
            opacity: 0.5
          };
      }
    };

    for (let i = 0; i < count; i++) {
      particles.push(createParticle());
    }

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, index) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        // Reset particle if off screen
        if (p.y > canvas.height + 20 || p.x < -20 || p.x > canvas.width + 20) {
          particles[index] = createParticle();
          particles[index].y = -20;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;

        if (p.char) {
          ctx.font = `${p.size}px sans-serif`;
          ctx.fillText(p.char, 0, 0);
        } else if (effectType === 'PEACH_BLOSSOM' || effectType === 'APRICOT_BLOSSOM') {
          // Draw a soft petal shape
          ctx.fillStyle = p.color || '#f472b6';
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Circle dot
          ctx.fillStyle = p.color || '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [effectType, intensity]);

  if (effectType === 'NONE') return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-30 w-full h-full overflow-hidden"
    />
  );
};
