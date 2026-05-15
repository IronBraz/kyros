/**
 * Audio Manager - handles Web Audio API with mobile browser restrictions
 *
 * Mobile browsers require user interaction before playing audio.
 * This module pre-unlocks AudioContext and provides reliable playback.
 */

type AudioContextType = AudioContext | (typeof window extends { webkitAudioContext: infer T } ? T : never);

let audioContext: AudioContextType | null = null;
let isUnlocked = false;

/**
 * Get or create the shared AudioContext
 */
const getAudioContext = (): AudioContextType | null => {
  if (!audioContext) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
      }
    } catch (e) {
      console.warn('Failed to create AudioContext:', e);
    }
  }
  return audioContext;
};

/**
 * Unlock the AudioContext - call this on any user interaction
 * in the WaitingRoom to prepare for notification sounds
 */
export const unlockAudio = async (): Promise<boolean> => {
  if (isUnlocked) return true;

  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    // Resume the context (required for mobile)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Play a silent sound to fully unlock
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0; // Silent
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.001);

    isUnlocked = true;
    console.log('Audio unlocked successfully');
    return true;
  } catch (e) {
    console.warn('Failed to unlock audio:', e);
    return false;
  }
};

/**
 * Check if audio is unlocked and ready
 */
export const isAudioReady = (): boolean => {
  return isUnlocked && audioContext?.state === 'running';
};

/**
 * Play the notification "ding-dong" sound
 */
export const playNotificationSound = async (): Promise<boolean> => {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    // Try to resume if suspended
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      // Fade in and out for smoother sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Ding (high note)
    playTone(880, now, 0.3);        // A5
    // Dong (lower note)
    playTone(659, now + 0.3, 0.4);  // E5
    // Second ding (higher)
    playTone(1047, now + 0.7, 0.3); // C6

    return true;
  } catch (e) {
    console.warn('Could not play notification sound:', e);
    return false;
  }
};

/**
 * Trigger vibration with fallbacks
 */
export const triggerVibration = (): void => {
  if ('vibrate' in navigator) {
    try {
      // Strong attention-grabbing pattern
      navigator.vibrate([300, 100, 300, 100, 500, 100, 300]);
    } catch (e) {
      console.warn('Vibration failed:', e);
    }
  }
};

/**
 * Play full alert (sound + vibration) with retry mechanism
 */
export const playAlert = async (retries = 3): Promise<boolean> => {
  triggerVibration();

  for (let i = 0; i < retries; i++) {
    const soundPlayed = await playNotificationSound();
    if (soundPlayed) {
      return true;
    }
    // Wait a bit before retry
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return false;
};
