'use client';

import { useState, useEffect, type CSSProperties } from 'react';

type Firefly = { left: number; top: number; delay: number; duration: number; size: number };
type Leaf = { top: number; delay: number; duration: number; size: number; rotation: number };
type Particles = { fireflies: Firefly[]; leaves: Leaf[] };

export default function JungleBackground() {
  const [particles, setParticles] = useState<Particles | null>(null);

  useEffect(() => {
    setParticles({
      fireflies: Array.from({ length: 26 }, () => ({
        left: Math.random() * 100,
        top: 8 + Math.random() * 72,
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 3,
        size: 3 + Math.random() * 3,
      })),
      leaves: Array.from({ length: 8 }, () => ({
        top: 5 + Math.random() * 80,
        delay: Math.random() * 18,
        duration: 16 + Math.random() * 14,
        size: 18 + Math.random() * 20,
        rotation: Math.random() * 360,
      })),
    });
  }, []);

  return (
    <div className="jungle-bg" aria-hidden>
      <div className="jungle-sun" />
      <div className="cloud cloud-1" />
      <div className="cloud cloud-2" />
      <div className="cloud cloud-3" />

      <svg className="jungle-mountains" viewBox="0 0 1440 400" preserveAspectRatio="none">
        <path
          d="M0,300 L60,250 L160,290 L260,220 L360,260 L480,200 L580,250 L700,180 L820,240 L940,200 L1080,260 L1200,230 L1320,260 L1440,210 L1440,400 L0,400 Z"
          fill="#1f4d2b"
          opacity="0.55"
        />
      </svg>

      <svg className="jungle-canopy" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path
          d="M0,160 Q40,100 80,150 Q120,90 170,140 Q220,80 270,140 Q320,100 380,150 Q430,90 490,140 Q540,80 600,140 Q650,100 720,150 Q780,80 840,140 Q900,100 960,150 Q1020,90 1080,140 Q1140,100 1200,150 Q1260,90 1320,150 Q1380,100 1440,140 L1440,320 L0,320 Z"
          fill="#173a20"
        />
      </svg>

      <svg className="jungle-foreground" viewBox="0 0 1440 240" preserveAspectRatio="none">
        <path
          d="M0,80 Q30,30 80,70 Q150,110 220,50 Q280,10 340,60 Q400,110 480,40 Q540,5 620,55 Q700,110 780,50 Q860,10 940,55 Q1020,110 1100,55 Q1180,5 1260,55 Q1340,100 1440,55 L1440,240 L0,240 Z"
          fill="#0f2a16"
        />
      </svg>

      {/* Stylized palm tree silhouettes — left + right edges */}
      <svg className="palm palm-left" viewBox="0 0 200 320" preserveAspectRatio="xMinYMax meet">
        <path d="M96,320 Q88,220 102,110 Q116,220 108,320 Z" fill="#2a1a0c" />
        <ellipse cx="80"  cy="100" rx="70" ry="14" transform="rotate(-25 80 100)"  fill="#173a20" />
        <ellipse cx="120" cy="100" rx="70" ry="14" transform="rotate(25 120 100)"  fill="#173a20" />
        <ellipse cx="100" cy="80"  rx="65" ry="12" transform="rotate(-55 100 80)"  fill="#0f2a16" />
        <ellipse cx="100" cy="80"  rx="65" ry="12" transform="rotate(55 100 80)"   fill="#0f2a16" />
        <ellipse cx="100" cy="92"  rx="68" ry="13" transform="rotate(0 100 92)"    fill="#1f4d2b" />
      </svg>

      <svg className="palm palm-right" viewBox="0 0 200 320" preserveAspectRatio="xMaxYMax meet">
        <path d="M96,320 Q88,220 102,110 Q116,220 108,320 Z" fill="#2a1a0c" />
        <ellipse cx="80"  cy="100" rx="70" ry="14" transform="rotate(-25 80 100)"  fill="#173a20" />
        <ellipse cx="120" cy="100" rx="70" ry="14" transform="rotate(25 120 100)"  fill="#173a20" />
        <ellipse cx="100" cy="80"  rx="65" ry="12" transform="rotate(-55 100 80)"  fill="#0f2a16" />
        <ellipse cx="100" cy="80"  rx="65" ry="12" transform="rotate(55 100 80)"   fill="#0f2a16" />
        <ellipse cx="100" cy="92"  rx="68" ry="13" transform="rotate(0 100 92)"    fill="#1f4d2b" />
      </svg>

      {particles && (
        <>
          {particles.fireflies.map((f, i) => (
            <span
              key={`f-${i}`}
              className="firefly"
              style={{
                left: `${f.left}%`,
                top: `${f.top}%`,
                width: `${f.size}px`,
                height: `${f.size}px`,
                animationDelay: `${f.delay}s`,
                animationDuration: `${f.duration}s`,
              }}
            />
          ))}
          {particles.leaves.map((l, i) => (
            <span
              key={`l-${i}`}
              className="floating-leaf"
              style={{
                top: `${l.top}%`,
                fontSize: `${l.size}px`,
                animationDelay: `${l.delay}s`,
                animationDuration: `${l.duration}s`,
                ['--leaf-rot' as string]: `${l.rotation}deg`,
              } as CSSProperties}
            >
              🍃
            </span>
          ))}
        </>
      )}
    </div>
  );
}
