// Web Audio API Retro 16-Bit Chiptune / FM Synthesizer (Zero External Dependencies)

export type MusicTrack = 'battle' | 'victory' | 'dialogue';

export class MusicSynthesizer {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  public currentTrack: MusicTrack | null = null;
  private isPlaying: boolean = false;

  private tempo: number = 132; // BPM
  private stepTimer: number | null = null;
  private currentStep: number = 0;
  private masterGain: GainNode | null = null;

  constructor() {
    // Initialized on first user gesture
  }

  private initAudio(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.18, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.18, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public playTrack(track: MusicTrack): void {
    if (this.currentTrack === track && this.isPlaying) return;
    this.stop();

    const ctx = this.initAudio();
    if (!ctx) return;

    this.currentTrack = track;
    this.isPlaying = true;
    this.currentStep = 0;

    if (track === 'battle') {
      this.tempo = 136;
      this.scheduleLoop(this.battleStep.bind(this));
    } else if (track === 'victory') {
      this.tempo = 118;
      this.scheduleLoop(this.victoryStep.bind(this));
    } else if (track === 'dialogue') {
      this.tempo = 104;
      this.scheduleLoop(this.dialogueStep.bind(this));
    }
  }

  public stop(): void {
    this.isPlaying = false;
    this.currentTrack = null;
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private scheduleLoop(callback: () => void): void {
    const stepDurationMs = (60 / this.tempo / 4) * 1000; // 16th note in ms
    this.stepTimer = window.setInterval(callback, stepDurationMs);
  }

  // --- Voice Generators ---

  private playTone(freq: number, durationSec: number, type: OscillatorType, volume: number, decay: boolean = true): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(volume, now);
    if (decay) {
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + durationSec);
  }

  private playNoise(durationSec: number, volume: number): void {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * durationSec;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start(now);
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // --- Track 1: Battle Theme (Heroic Tactics March in D Minor) ---
  // 32-step 16th note pattern loop
  private battleStep(): void {
    if (!this.isPlaying) return;
    const step = this.currentStep % 32;
    this.currentStep++;

    // 1. Percussion Channel (Snare on 4, 12, 20, 28; Hat on even steps)
    if (step % 8 === 4) {
      this.playNoise(0.09, 0.16); // Snare drum
    } else if (step % 2 === 0) {
      this.playNoise(0.03, 0.05); // Closed Hi-Hat
    }

    // 2. Bassline Channel (D minor driving arpeggiated bass)
    // Scale: D2 (38), F2 (41), G2 (43), A2 (45), C3 (48)
    const bassPattern = [
      38, 38, 45, 38,  41, 38, 45, 38, // Dm
      36, 36, 43, 36,  40, 36, 43, 36, // C
      34, 34, 41, 34,  38, 34, 41, 34, // Bb
      33, 33, 40, 33,  45, 43, 41, 40  // A
    ];
    const bassNote = bassPattern[step];
    if (bassNote) {
      this.playTone(this.midiToFreq(bassNote), 0.14, 'triangle', 0.28);
    }

    // 3. Arpeggio / Chord Accompaniment Channel (Square wave)
    const arpNotes = [
      62, 65, 69, 74,  62, 65, 69, 72,
      60, 64, 67, 72,  60, 64, 67, 72,
      58, 62, 65, 70,  58, 62, 65, 70,
      57, 61, 64, 69,  57, 61, 64, 69
    ];
    if (step % 2 === 0) {
      this.playTone(this.midiToFreq(arpNotes[step]), 0.11, 'square', 0.08);
    }

    // 4. Lead Melody Channel (Triumphant fanfare motif)
    const melodyMap: Record<number, { note: number; dur: number }> = {
      0:  { note: 62, dur: 0.22 }, // D4
      4:  { note: 65, dur: 0.22 }, // F4
      8:  { note: 69, dur: 0.45 }, // A4
      14: { note: 72, dur: 0.22 }, // C5
      16: { note: 74, dur: 0.55 }, // D5
      22: { note: 72, dur: 0.22 }, // C5
      24: { note: 69, dur: 0.35 }, // A4
      28: { note: 67, dur: 0.22 }  // G4
    };
    if (melodyMap[step]) {
      const m = melodyMap[step];
      this.playTone(this.midiToFreq(m.note), m.dur, 'square', 0.16);
    }
  }

  // --- Track 2: Victory Fanfare (C Major Triumphant March) ---
  private victoryStep(): void {
    if (!this.isPlaying) return;
    const step = this.currentStep % 32;
    this.currentStep++;

    // Snare roll on victory
    if (step === 0 || step === 4 || step === 8 || step === 12 || step === 14 || step === 15) {
      this.playNoise(0.08, 0.18);
    }

    // Victory Brass Chords
    const brassChords: Record<number, number[]> = {
      0:  [60, 64, 67], // C major
      4:  [60, 64, 67],
      8:  [60, 64, 67],
      12: [62, 65, 69], // Dm
      16: [64, 67, 72], // Em
      20: [65, 69, 72], // F
      24: [67, 71, 74], // G
      28: [72, 76, 79]  // High C Major!
    };

    if (brassChords[step]) {
      for (const note of brassChords[step]) {
        this.playTone(this.midiToFreq(note), 0.32, 'square', 0.11);
      }
      // Bass root
      this.playTone(this.midiToFreq(brassChords[step][0] - 24), 0.35, 'triangle', 0.3);
    }
  }

  // --- Track 3: Story & Dialogue (Calm, Reflective Harp Atmosphere) ---
  private dialogueStep(): void {
    if (!this.isPlaying) return;
    const step = this.currentStep % 32;
    this.currentStep++;

    // Ambient harp arpeggios
    const harpNotes = [
      57, 60, 64, 69,  72, 69, 64, 60, // Am
      53, 57, 60, 65,  69, 65, 60, 57, // F
      55, 59, 62, 67,  71, 67, 62, 59, // G
      52, 55, 59, 64,  67, 64, 59, 55  // Em
    ];

    if (step % 2 === 0) {
      const note = harpNotes[step];
      this.playTone(this.midiToFreq(note), 0.45, 'triangle', 0.15);
    }

    if (step === 0) {
      // Gentle low pad note
      this.playTone(this.midiToFreq(45), 1.2, 'sine', 0.22, false);
    } else if (step === 16) {
      this.playTone(this.midiToFreq(41), 1.2, 'sine', 0.22, false);
    }
  }
}

export const Music = new MusicSynthesizer();
