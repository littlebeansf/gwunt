// Gwunt Audio Engine
// Handles background music (looping) and sound effects with fade transitions.
// Uses Web Audio API with OGG files generated via scipy synthesis.

type Track = 'title' | 'battle' | 'none';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private currentTrack: Track = 'none';
  private currentSource: AudioBufferSourceNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private muted = false;
  private musicVolume = 0.35;
  private sfxVolume = 0.7;
  private loadedFiles = new Set<string>();

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
    }
    return this.ctx;
  }

  private async loadBuffer(name: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(name)) return this.buffers.get(name)!;
    try {
      const ctx = this.getCtx();
      const res = await fetch(`./audio/${name}.ogg`);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      this.buffers.set(name, buf);
      return buf;
    } catch {
      return null;
    }
  }

  // Preload all audio files in background
  async preload() {
    const files = ['title_theme', 'battle_theme', 'victory_fanfare', 'defeat_sting',
                   'card_play', 'card_hover', 'weather_play', 'round_win', 'round_lose',
                   'button_click', 'pass_turn'];
    await Promise.all(files.map(f => this.loadBuffer(f)));
  }

  async playMusic(track: Track, fadeMs = 1200) {
    if (track === this.currentTrack) return;
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    // Fade out current
    if (this.currentSource && this.musicGain) {
      const old = this.currentSource;
      const gain = this.musicGain;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
      setTimeout(() => { try { old.stop(); } catch {} }, fadeMs + 100);
    }

    this.currentTrack = track;
    if (track === 'none') return;

    const bufName = track === 'title' ? 'title_theme' : 'battle_theme';
    const buf = await this.loadBuffer(bufName);
    if (!buf || !this.musicGain) return;

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    source.connect(this.musicGain);
    this.currentSource = source;

    // Fade in
    const now = ctx.currentTime;
    this.musicGain.gain.setValueAtTime(0, now);
    this.musicGain.gain.linearRampToValueAtTime(this.muted ? 0 : this.musicVolume, now + fadeMs / 1000);
    source.start(0);
  }

  async playSfx(name: string) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      if (ctx.state === 'suspended') await ctx.resume();
      const buf = await this.loadBuffer(name);
      if (!buf || !this.sfxGain) return;
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(this.sfxGain);
      source.start(0);
    } catch {}
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(this.muted ? 0 : 1, now + 0.3);
    }
    return this.muted;
  }

  isMuted() { return this.muted; }

  async resume() {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
  }
}

export const audio = new AudioEngine();
