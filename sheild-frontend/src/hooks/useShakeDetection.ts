import { useEffect, useRef, useCallback } from 'react';
import { useSosStore } from '../stores/sosStore';

export function useShakeDetection(onShakeConfirmed: () => void) {
  const breachTimestampsRef = useRef<number[]>([]);
  const lastBreachTimeRef = useRef(0);
  const cooldownActiveRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerAttachedRef = useRef(false);
  const onShakeConfirmedRef = useRef(onShakeConfirmed);

  const shakeToSosEnabled = useSosStore((s) => s.shakeToSosEnabled);
  const permissionState = useSosStore((s) => s.permissionState);

  // Keep callback ref fresh without re-attaching listener
  useEffect(() => {
    onShakeConfirmedRef.current = onShakeConfirmed;
  }, [onShakeConfirmed]);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    // Guard 1: Cooldown active
    if (cooldownActiveRef.current) return;

    // Guard 2: Feature disabled
    const { shakeToSosEnabled, sosActive } = useSosStore.getState();
    if (!shakeToSosEnabled) return;

    // Guard 3: SOS already active
    if (sosActive) return;

    // Prefer pure acceleration (excludes gravity, rests at ~0)
    // Fallback to accelerationIncludingGravity (~9.8 at rest)
    const accelPure = event.acceleration;
    const accelGravity = event.accelerationIncludingGravity;

    let magnitude: number;
    let threshold: number;

    if (accelPure && accelPure.x != null && accelPure.y != null && accelPure.z != null) {
      magnitude = Math.sqrt(
        (accelPure.x ** 2) + (accelPure.y ** 2) + (accelPure.z ** 2)
      );
      threshold = 15; // Moderate shake on pure acceleration
    } else if (accelGravity && accelGravity.x != null && accelGravity.y != null && accelGravity.z != null) {
      magnitude = Math.sqrt(
        (accelGravity.x ** 2) + (accelGravity.y ** 2) + (accelGravity.z ** 2)
      );
      threshold = 25; // Higher threshold to compensate for gravity baseline
    } else {
      return;
    }

    const MIN_INTERVAL_MS = 120; // At least 120ms between distinct shakes (avoids 1 bump counting 3x)
    const WINDOW_MS = 1400;      // 1.4 second window to complete 3 rapid shakes
    const REQUIRED_SHAKES = 3;

    if (magnitude > threshold) {
      const now = Date.now();

      // Debounce: ignore consecutive high-g frames of the same physical shake movement
      if (now - lastBreachTimeRef.current < MIN_INTERVAL_MS) {
        return;
      }

      lastBreachTimeRef.current = now;
      breachTimestampsRef.current.push(now);

      // Keep only shakes within the active sliding window
      breachTimestampsRef.current = breachTimestampsRef.current.filter(
        (t) => now - t <= WINDOW_MS
      );

      console.log(`[SHEild Shake] 📳 Shake peak detected! count=${breachTimestampsRef.current.length}/${REQUIRED_SHAKES} (mag=${magnitude.toFixed(1)})`);

      if (breachTimestampsRef.current.length >= REQUIRED_SHAKES) {
        console.log('[SHEild Shake] ✅ 3x SHAKES CONFIRMED — triggering SOS countdown overlay');
        breachTimestampsRef.current = [];
        lastBreachTimeRef.current = 0;
        cooldownActiveRef.current = true;

        cooldownTimerRef.current = setTimeout(() => {
          cooldownActiveRef.current = false;
        }, 4000);

        onShakeConfirmedRef.current();
      }
    }
  }, []);

  const attachListener = useCallback(() => {
    if (!listenerAttachedRef.current && typeof window !== 'undefined') {
      window.addEventListener('devicemotion', handleMotion);
      listenerAttachedRef.current = true;
      useSosStore.getState().setShakeListening(true);
      console.log('[SHEild Shake] 🎧 Motion listener active & listening');
    }
  }, [handleMotion]);

  const detachListener = useCallback(() => {
    if (listenerAttachedRef.current && typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', handleMotion);
      listenerAttachedRef.current = false;
      useSosStore.getState().setShakeListening(false);
      console.log('[SHEild Shake] ⏹️ Motion listener detached');
    }
  }, [handleMotion]);

  const requestPermission = useCallback(async (): Promise<void> => {
    if (typeof (DeviceMotionEvent as any)?.requestPermission !== 'function') {
      useSosStore.getState().setPermissionState('granted');
      attachListener();
      return;
    }
    try {
      const result = await (DeviceMotionEvent as any).requestPermission();
      if (result === 'granted') {
        useSosStore.getState().setPermissionState('granted');
        attachListener();
      } else {
        useSosStore.getState().setPermissionState('denied');
        detachListener();
      }
    } catch {
      useSosStore.getState().setPermissionState('denied');
      detachListener();
    }
  }, [attachListener, detachListener]);

  // Initial detection on mount
  useEffect(() => {
    const store = useSosStore.getState();

    if (typeof DeviceMotionEvent === 'undefined') {
      store.setPermissionState('unsupported');
      console.log('[SHEild Shake] ❌ DeviceMotionEvent unsupported on this platform');
      return;
    }

    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      // iOS 13+ requires user gesture
      store.setPermissionState('prompt');
      console.log('[SHEild Shake] 📱 iOS detected — waiting for user permission gesture');
    } else {
      // Android / Desktop — granted by default
      store.setPermissionState('granted');
    }
  }, []);

  // Dynamically attach or detach listener based on shakeToSosEnabled & permissionState
  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') return;

    if (!shakeToSosEnabled) {
      detachListener();
      breachTimestampsRef.current = [];
      lastBreachTimeRef.current = 0;
      return;
    }

    if (permissionState === 'granted') {
      attachListener();
    }
  }, [shakeToSosEnabled, permissionState, attachListener, detachListener]);

  // Provide global test simulator for desktop and manual testing
  useEffect(() => {
    (window as any).simulateShake = () => {
      const { shakeToSosEnabled, sosActive } = useSosStore.getState();
      if (!shakeToSosEnabled) {
        console.warn('[SHEild Shake] Shake-to-SOS is currently DISABLED in settings');
        return false;
      }
      if (sosActive) {
        console.warn('[SHEild Shake] SOS is already active');
        return false;
      }
      console.log('[SHEild Shake] 🧪 Simulating 3x shake trigger...');
      onShakeConfirmedRef.current();
      return true;
    };

    return () => {
      delete (window as any).simulateShake;
      detachListener();
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, [detachListener]);

  return { requestPermission };
}
