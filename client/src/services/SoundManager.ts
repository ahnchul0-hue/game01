// Procedural Web Audio API sound engine for Capybara Runner (no audio files).

export type SfxName = 'jump' | 'slide' | 'collect' | 'hit' | 'powerup' | 'button' | 'gameover' | 'levelup';
export type BgmName = 'bgm-menu' | 'bgm-game' | 'bgm-onsen';

const LS_KEY_MUTED = 'capybara_muted';
let _instance: SoundManager | null = null;

export class SoundManager {
    private ctx: AudioContext | null = null;
    private sfxGain: GainNode | null = null;
    private bgmGain: GainNode | null = null;
    private bgmNodes: AudioNode[] = [];
    private _muted: boolean;

    private constructor() {
        this._muted = localStorage.getItem(LS_KEY_MUTED) === 'true';
    }

    static getInstance(): SoundManager {
        if (!_instance) _instance = new SoundManager();
        return _instance;
    }

    /** Create AudioContext on first user interaction (browser autoplay policy). */
    init(): void {
        if (this.ctx) return;
        this.ctx = new AudioContext();
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this._muted ? 0 : 0.6;
        this.sfxGain.connect(this.ctx.destination);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this._muted ? 0 : 0.18;
        this.bgmGain.connect(this.ctx.destination);
    }

    // ---- SFX ----------------------------------------------------------------

    playSfx(name: SfxName): void {
        if (!this.ctx || !this.sfxGain || this._muted) return;
        switch (name) {
            case 'jump':     this._tone('sine',     440,  0.08, 660);  break;
            case 'slide':    this._tone('sawtooth', 220,  0.12, 110);  break;
            case 'collect':  this._collect();                          break;
            case 'hit':      this._hit();                              break;
            case 'powerup':  this._tone('sine',     660,  0.25, 1320); break;
            case 'button':   this._tone('sine',     600,  0.04);       break;
            case 'gameover': this._tone('sine',     440,  0.4,  220);  break;
            case 'levelup':  this._levelup();                          break;
        }
    }

    private _t(): number { return this.ctx!.currentTime; }

    /** Schedule one oscillator tone with exponential fade-out. */
    private _tone(
        type: OscillatorType, freq: number, dur: number,
        freqEnd?: number, at: number = this._t(),
    ): void {
        const ctx = this.ctx!;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, at);
        if (freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(freqEnd, at + dur);
        env.gain.setValueAtTime(0.8, at);
        env.gain.exponentialRampToValueAtTime(0.001, at + dur);
        osc.connect(env);
        env.connect(this.sfxGain!);
        osc.start(at);
        osc.stop(at + dur + 0.01);
    }

    private _collect(): void {
        const t = this._t();
        this._tone('sine', 523, 0.1, undefined, t);
        this._tone('sine', 659, 0.1, undefined, t + 0.1);
    }

    private _hit(): void {
        const ctx = this.ctx!;
        const t = this._t();
        this._tone('square', 150, 0.15, 80, t);
        // White noise burst for impact texture
        const bufSize = Math.floor(ctx.sampleRate * 0.12);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        noise.connect(g);
        g.connect(this.sfxGain!);
        noise.start(t);
    }

    private _levelup(): void {
        const t = this._t();
        [523, 659, 784].forEach((f, i) => this._tone('sine', f, 0.08, undefined, t + i * 0.08));
    }

    // ---- BGM ----------------------------------------------------------------

    playBgm(name: BgmName): void {
        if (!this.ctx || !this.bgmGain) return;
        this.stopBgm();
        switch (name) {
            case 'bgm-menu':  this._bgmMenu();  break;
            case 'bgm-game':  this._bgmGame();  break;
            case 'bgm-onsen': this._bgmOnsen(); break;
        }
    }

    stopBgm(): void {
        for (const node of this.bgmNodes) {
            try { (node as OscillatorNode | AudioBufferSourceNode).stop(); } catch { /* already stopped */ }
        }
        this.bgmNodes = [];
    }

    /** Soft pad: C4+E4+G4 sine chord, looping. */
    private _bgmMenu(): void {
        for (const freq of [261.63, 329.63, 392.0]) {
            const osc = this.ctx!.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(this.bgmGain!);
            osc.start();
            this.bgmNodes.push(osc);
        }
    }

    /** Bass drone + LFO tremolo for a rhythmic pulse. */
    private _bgmGame(): void {
        const ctx = this.ctx!;
        const drone = ctx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = 110;

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 2.5;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;
        lfo.connect(lfoGain);

        const pulseGain = ctx.createGain();
        pulseGain.gain.value = 0.5;
        lfoGain.connect(pulseGain.gain);
        drone.connect(pulseGain);
        pulseGain.connect(this.bgmGain!);

        drone.start(); lfo.start();
        this.bgmNodes.push(drone, lfo);
    }

    /** Bandpass-filtered looping white noise for water ambience. */
    private _bgmOnsen(): void {
        const ctx = this.ctx!;
        const bufSize = ctx.sampleRate * 4;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 600;
        filter.Q.value = 0.8;

        source.connect(filter);
        filter.connect(this.bgmGain!);
        source.start();
        this.bgmNodes.push(source);
    }

    // ---- Volume / Mute ------------------------------------------------------

    setMuted(muted: boolean): void {
        this._muted = muted;
        localStorage.setItem(LS_KEY_MUTED, String(muted));
        if (this.sfxGain) this.sfxGain.gain.value = muted ? 0 : 0.6;
        if (this.bgmGain) this.bgmGain.gain.value = muted ? 0 : 0.18;
    }

    isMuted(): boolean { return this._muted; }
    isReady(): boolean { return this.ctx !== null; }
}
