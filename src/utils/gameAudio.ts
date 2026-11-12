import type { GameSettings } from './gameSettings';
export type SoundCue = 'jump' | 'coin' | 'success' | 'mistake' | 'complete' | 'tap';
let context: AudioContext | null = null;
export function playGameSound(cue: SoundCue, settings: GameSettings) {
  if (!settings.soundEnabled || settings.volume <= 0 || typeof window === 'undefined') return;
  try {
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return;
    context ??= new AudioContextCtor();
    if (context.state === 'suspended') { void context.resume().catch(() => {}); }
    const notes: Record<SoundCue, number[]> = {
      jump: [440, 659], coin: [740, 988], success: [523, 659, 784],
      mistake: [300, 230], complete: [523, 659, 784, 1047], tap: [523],
    };
    const start = context.currentTime;
    notes[cue].forEach((frequency, index) => {
      if (!context) return;
      const at = start + index * 0.085;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = cue === 'mistake' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, settings.volume * 0.085), at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.17);
    });
  } catch { /* Audio may be blocked by browser policy; gameplay continues. */ }
}
