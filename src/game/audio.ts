import type { ZoneId } from './types';

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private stepIndex = 0;

  private musicEnabled = true;
  private sfxEnabled = true;
  private musicVolume = 0.42;
  private sfxVolume = 0.7;
  private activeZone: ZoneId = 'forest';
  private isPlayingRun = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? this.musicVolume : 0;
      this.musicGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public configure(opts: {
    musicEnabled: boolean;
    sfxEnabled: boolean;
    musicVolume: number;
    sfxVolume: number;
  }): void {
    this.musicEnabled = opts.musicEnabled;
    this.sfxEnabled = opts.sfxEnabled;
    this.musicVolume = opts.musicVolume;
    this.sfxVolume = opts.sfxVolume;

    if (this.ctx && this.musicGain && this.sfxGain) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.setTargetAtTime(
        this.musicEnabled ? this.musicVolume : 0,
        now,
        0.04,
      );
      this.sfxGain.gain.setTargetAtTime(
        this.sfxEnabled ? this.sfxVolume : 0,
        now,
        0.04,
      );
    }
  }

  public setZone(zone: ZoneId): void {
    if (this.activeZone !== zone) {
      this.activeZone = zone;
      this.stepIndex = 0;
    }
  }

  public startMusic(zone: ZoneId): void {
    this.activeZone = zone;
    this.isPlayingRun = true;
    this.ensureContext();
    if (this.musicTimer !== null) return;

    const tempoMs = zone === 'snow' ? 230 : zone === 'forest' ? 195 : 175;
    this.musicTimer = window.setInterval(() => {
      if (!this.isPlayingRun || !this.musicEnabled) return;
      this.tickMusicNote();
    }, tempoMs);
  }

  public stopMusic(): void {
    this.isPlayingRun = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public restartMusicForZone(zone: ZoneId): void {
    this.stopMusic();
    this.startMusic(zone);
  }

  private tickMusicNote(): void {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const s = this.stepIndex++;

    if (this.activeZone === 'snow') {
      // Crystalline Dorian winter arpeggio + sub bass pulse
      const arp = [523.25, 622.25, 783.99, 932.33, 783.99, 622.25, 698.46, 587.33];
      const bass = [130.81, 130.81, 155.56, 155.56, 116.54, 116.54, 146.83, 130.81];
      const note = arp[s % arp.length];
      this.playTone(note, 'sine', 0.24, 0.14, now, dest);
      if (s % 2 === 0) {
        this.playTone(note * 2, 'triangle', 0.12, 0.045, now + 0.03, dest);
      }
      if (s % 4 === 0) {
        this.playTone(bass[Math.floor(s / 4) % bass.length], 'triangle', 0.45, 0.14, now, dest);
      }
    } else if (this.activeZone === 'forest') {
      // Enchanted Lydian woodland flute + plucked harp
      const melody = [392.0, 493.88, 587.33, 739.99, 659.25, 587.33, 493.88, 440.0];
      const bass = [196.0, 196.0, 220.0, 164.81];
      const freq = melody[s % melody.length];
      this.playTone(freq, 'triangle', 0.2, 0.13, now, dest);
      if (s % 3 === 0) {
        this.playTone(freq * 1.5, 'sine', 0.28, 0.07, now + 0.02, dest);
      }
      if (s % 4 === 0) {
        this.playTone(bass[Math.floor(s / 4) % bass.length], 'sine', 0.36, 0.16, now, dest);
      }
    } else {
      // Epic Mountain heroic brass-saw pulse + marching drum hit
      const lead = [293.66, 349.23, 440.0, 523.25, 440.0, 392.0, 349.23, 329.63];
      const bass = [73.42, 73.42, 87.31, 98.0];
      const freq = lead[s % lead.length];
      this.playTone(freq, 'sawtooth', 0.16, 0.07, now, dest, 1200);
      if (s % 2 === 0) {
        this.playKick(now, dest, 0.14);
      }
      if (s % 4 === 0) {
        this.playTone(bass[Math.floor(s / 4) % bass.length], 'sawtooth', 0.32, 0.1, now, dest, 420);
      }
    }
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    gainPeak: number,
    startTime: number,
    dest: AudioNode,
    lowpassHz?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    if (lowpassHz) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowpassHz, startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playKick(startTime: number, dest: AudioNode, gainPeak = 0.2): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.12);
    gain.gain.setValueAtTime(gainPeak, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.15);
  }

  public playJump(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.14);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playSlide(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.16);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playLane(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(320, 'sine', 0.06, 0.1, now, this.sfxGain);
  }

  public playCoin(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(987.77, 'sine', 0.09, 0.18, now, this.sfxGain);
    this.playTone(1318.51, 'sine', 0.16, 0.18, now + 0.055, this.sfxGain);
  }

  public playFruit(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(587.33, 'triangle', 0.09, 0.2, now, this.sfxGain);
    this.playTone(880.0, 'triangle', 0.14, 0.2, now + 0.06, this.sfxGain);
  }

  public playBonus(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this.playTone(f, 'triangle', 0.14, 0.2, now + idx * 0.055, this.sfxGain!);
    });
  }

  public playPowerUp(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880, 1108.73].forEach((f, idx) => {
      this.playTone(f, 'sawtooth', 0.18, 0.11, now + idx * 0.05, this.sfxGain!, 2400);
    });
  }

  public playShieldBreak(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    this.playTone(620, 'sawtooth', 0.12, 0.18, now, this.sfxGain, 1800);
    this.playTone(280, 'triangle', 0.22, 0.22, now + 0.06, this.sfxGain);
  }

  public playDragonRoar(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.55);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(112, now);
    osc2.frequency.exponentialRampToValueAtTime(48, now + 0.55);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.55);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.65);
    osc2.stop(now + 0.65);
  }

  public playGameOver(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [349.23, 311.13, 261.63, 196.0].forEach((f, idx) => {
      this.playTone(f, 'sawtooth', 0.24, 0.14, now + idx * 0.12, this.sfxGain!, 1100);
    });
  }
}

export const gameAudio = new GameAudioEngine();
