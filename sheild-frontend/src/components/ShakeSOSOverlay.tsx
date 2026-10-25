import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Shield } from 'lucide-react';

interface ShakeSOSOverlayProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ShakeSOSOverlay({ visible, onConfirm, onCancel }: ShakeSOSOverlayProps) {
  const [count, setCount] = useState(3);
  const [animState, setAnimState] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>('hidden');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);

  // Keep refs fresh
  useEffect(() => {
    onConfirmRef.current = onConfirm;
    onCancelRef.current = onCancel;
  }, [onConfirm, onCancel]);

  // Handle visibility transitions
  useEffect(() => {
    if (visible) {
      setCount(3);
      setAnimState('entering');
      // Haptic feedback on appear
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      // Transition to visible after enter animation
      const enterTimer = setTimeout(() => setAnimState('visible'), 250);
      return () => clearTimeout(enterTimer);
    } else {
      if (animState !== 'hidden') {
        setAnimState('exiting');
        const exitTimer = setTimeout(() => setAnimState('hidden'), 200);
        return () => clearTimeout(exitTimer);
      }
    }
  }, [visible]);

  // Countdown timer
  useEffect(() => {
    if (animState === 'hidden' || animState === 'exiting') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (visible && (animState === 'entering' || animState === 'visible')) {
      intervalRef.current = setInterval(() => {
        setCount((prev) => {
          if (prev <= 1) {
            // Timer reached zero — fire SOS
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            // Use setTimeout to avoid state update during render
            setTimeout(() => onConfirmRef.current(), 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, animState]);

  if (animState === 'hidden') return null;

  const portalTarget = (typeof document !== 'undefined' ? document.getElementById('shake-portal') : null) || (typeof document !== 'undefined' ? document.body : null);
  if (!portalTarget) return null;

  // SVG countdown ring
  const RADIUS = 44;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const progress = count / 3;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(220, 38, 38, 0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    opacity: animState === 'exiting' ? 0 : animState === 'entering' ? 0 : 1,
    transform:
      animState === 'entering'
        ? 'scale(0.92)'
        : animState === 'exiting'
          ? 'scale(0.95)'
          : 'scale(1)',
    transition: animState === 'entering'
      ? 'opacity 0.25s ease-out, transform 0.25s ease-out'
      : 'opacity 0.2s ease-in, transform 0.2s ease-in',
    // Force animation start
    animation: animState === 'entering' ? 'shakeOverlayIn 0.25s ease-out forwards' : undefined,
  };

  return createPortal(
    <div style={overlayStyle} id="shake-sos-overlay">
      {/* Pulsing Shield Icon */}
      <div className="shake-pulse-icon">
        <Shield size={72} color="#fff" strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h1
        style={{
          color: '#fff',
          fontSize: '1.75rem',
          fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        SOS ACTIVATED
      </h1>

      {/* Sub-text */}
      <p
        style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: '0.875rem',
          fontFamily: "'DM Sans', sans-serif",
          margin: 0,
        }}
      >
        Shake detected — sending alert in...
      </p>

      {/* Countdown Ring */}
      <div style={{ position: 'relative', width: '120px', height: '120px' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* Background ring */}
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="6"
          />
          {/* Animated ring */}
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="#fff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.4s ease-in-out' }}
          />
        </svg>
        {/* Number inside ring */}
        <span
          key={count}
          className="shake-countdown-number"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem',
            fontWeight: 800,
            color: '#fff',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {count}
        </span>
      </div>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        style={{
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
          padding: '14px 40px',
          borderRadius: '999px',
          fontSize: '1rem',
          fontWeight: 600,
          fontFamily: "'Space Grotesk', sans-serif",
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          letterSpacing: '0.04em',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.background = '#fff';
          (e.target as HTMLButtonElement).style.color = '#dc2626';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
          (e.target as HTMLButtonElement).style.color = '#fff';
        }}
      >
        CANCEL
      </button>
    </div>,
    portalTarget
  );
}
