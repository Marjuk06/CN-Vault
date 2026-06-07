/**
 * useAutoLock.ts — Idle-based auto-lock for the vault.
 *
 * Implements Article IV.F of the Project Constitution:
 *   - Default timeout: 5 minutes
 *   - Configurable: 1–30 minutes
 *   - Triggers lockVault() after inactivity
 *   - Resets on any user interaction
 *
 * Strategy:
 *   1. Listen to mouse, keyboard, touch, and scroll events
 *   2. Record timestamp of last activity in a ref (never in state — no re-renders)
 *   3. Poll every 10s to check if idle time exceeded threshold
 *   4. On exceed: invoke lockVault()
 */

import { useEffect, useRef } from 'react';
import { useVaultStore } from '@/store/vaultStore';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
  'click',
] as const;

const POLL_INTERVAL_MS = 10_000;

export function useAutoLock() {
  const { status, settings, lockVault } = useVaultStore();
  const lastActivityRef = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== 'unlocked') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const timeoutMs = settings.autoLockMinutes * 60 * 1000;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true })
    );

    intervalRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= timeoutMs) {
        lockVault();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, settings.autoLockMinutes, lockVault]);
}
