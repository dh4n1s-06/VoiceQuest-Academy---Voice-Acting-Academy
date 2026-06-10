// Lightweight audio manager for VoiceQuest Academy.
// Gracefully no-ops if files are missing.

class AudioManager {
  private music: HTMLAudioElement | null = null;
  private currentTrack: string | null = null;
  private musicVolume = 0.2;

  playMusic(src: string, opts: { loop?: boolean; volume?: number } = {}) {
    if (typeof window === "undefined") return;
    if (this.currentTrack === src && this.music && !this.music.paused) return;
    this.stopMusic();
    const a = new Audio(src);
    a.loop = opts.loop ?? true;
    a.volume = 0;
    this.musicVolume = opts.volume ?? 0.2;
    this.music = a;
    this.currentTrack = src;
    a.play().catch(() => {});
    this.fadeTo(this.musicVolume, 800);
  }

  pauseMusic() {
    if (this.music) this.music.pause();
  }

  resumeMusic() {
    if (this.music && this.music.paused) {
      this.music.play().catch(() => {});
    }
  }

  stopMusic() {
    if (this.music) {
      const a = this.music;
      this.fadeTo(0, 500, () => {
        a.pause();
        a.src = "";
      });
      this.music = null;
      this.currentTrack = null;
    }
  }

  private fadeTo(target: number, ms: number, done?: () => void) {
    if (!this.music) return;
    const a = this.music;
    const start = a.volume;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const v = start + (target - start) * p;
      a.volume = Math.max(0, Math.min(1, v));
      if (p < 1) requestAnimationFrame(step);
      else done?.();
    };
    requestAnimationFrame(step);
  }

  playSfx(src: string, volume = 0.6) {
    if (typeof window === "undefined") return;
    try {
      const a = new Audio(src);
      a.volume = volume;
      a.play().catch(() => {});
    } catch {}
  }
}

export const audio = new AudioManager();

import correctSfx from "@/assets/audio/correct-sfx.mp3.asset.json";
import wrongSfx from "@/assets/audio/wrong-sfx.mp3.asset.json";
import achievementSfx from "@/assets/audio/achievement-sfx.mp3.asset.json";
import sceneUnlockSfx from "@/assets/audio/scene-unlock-sfx.mp3.asset.json";
import graduationSfx from "@/assets/audio/graduation-sfx.mp3.asset.json";
import academyTheme from "@/assets/audio/academy-theme.mp3.asset.json";
import graduationTheme from "@/assets/audio/graduation-theme.mp3.asset.json";

export const SFX = {
  correct: correctSfx.url,
  wrong: wrongSfx.url,
  achievement: achievementSfx.url,
  sceneUnlocked: sceneUnlockSfx.url,
  graduation: graduationSfx.url,
};

export const MUSIC = {
  academy: academyTheme.url,
  graduation: graduationTheme.url,
};
