// Procedural Web Audio API sound engine for Capybara Runner (no audio files).

export type SfxName = 'jump' | 'slide' | 'collect' | 'hit' | 'powerup' | 'button' | 'gameover' | 'levelup';
export type BgmName = 'bgm-menu' | 'bgm-game' | 'bgm-onsen';

const LS_KEY_MUTED = 'capybara_muted';
const LS_KEY_BGM_VOL = 'capybara_bgm_vol';
const LS_KEY_SFX_VOL = 'capybara_sfx_vol';
let _instance: SoundManager | null = null;

export class SoundManager {
    private ctx: AudioContext | null = null;
    private sfxGain: GainNode | null = null;
    private bgmGain: GainNode | null = null;
    private bgmNodes: AudioNode[] = [];
    private _muted: boolean;
    private _bgmVol: number;
    private _sfxVol: number;

    private constructor() {
        this._muted = localStorage.getItem(LS_KEY_MUTED) === 'true';
        this._bgmVol = parseFloat(localStorage.getItem(LS_KEY_BGM_VOL) ?? '0.18');
        this._sfxVol = parseFloat(localStorage.getItem(LS_KEY_SFX_VOL) ?? '0.6');
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
        this.sfxGain.gain.value = this._muted ? 0 : this._sfxVol;
        this.sfxGain.connect(this.ctx.destination);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this._muted ? 0 : this._bgmVol;
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

    private _t(): number {
        if (!this.ctx) return 0;
        return this.ctx.currentTime;
    }

    /** Schedule one oscillator tone with exponential fade-out. */
    private _tone(
        type: OscillatorType, freq: number, dur: number,
        freqEnd?: number, at: number = this._t(),
    ): void {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, at);
        if (freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(freqEnd, at + dur);
        env.gain.setValueAtTime(0.8, at);
        env.gain.exponentialRampToValueAtTime(0.001, at + dur);
        osc.connect(env);
        env.connect(this.sfxGain);
        osc.start(at);
        osc.stop(at + dur + 0.01);
    }

    private _collect(): void {
        const t = this._t();
        this._tone('sine', 523, 0.1, undefined, t);
        this._tone('sine', 659, 0.1, undefined, t + 0.1);
    }

    private _hit(): void {
        if (!this.ctx || !this.sfxGain) return;
        const t = this._t();
        this._tone('square', 150, 0.15, 80, t);
        // White noise burst for impact texture
        const bufSize = Math.floor(this.ctx.sampleRate * 0.12);
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        noise.connect(g);
        g.connect(this.sfxGain);
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
            try { node.disconnect(); } catch { /* already disconnected */ }
        }
        this.bgmNodes = [];
    }

    /** Soft pad: C4+E4+G4 sine chord, looping. */
    private _bgmMenu(): void {
        if (!this.ctx || !this.bgmGain) return;
        for (const freq of [261.63, 329.63, 392.0]) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(this.bgmGain);
            osc.start();
            this.bgmNodes.push(osc);
        }
    }

    /** Bass drone + LFO tremolo for a rhythmic pulse. */
    private _bgmGame(): void {
        if (!this.ctx || !this.bgmGain) return;
        const drone = this.ctx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = 110;

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 2.5;

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.5;
        lfo.connect(lfoGain);

        const pulseGain = this.ctx.createGain();
        pulseGain.gain.value = 0.5;
        lfoGain.connect(pulseGain.gain);
        drone.connect(pulseGain);
        pulseGain.connect(this.bgmGain);

        drone.start(); lfo.start();
        this.bgmNodes.push(drone, lfo, lfoGain, pulseGain);
    }

    /** Bandpass-filtered looping white noise for water ambience. */
    private _bgmOnsen(): void {
        if (!this.ctx || !this.bgmGain) return;
        const bufSize = this.ctx.sampleRate * 4;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const source = this.ctx.createBufferSource();
        source.buffer = buf;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 600;
        filter.Q.value = 0.8;

        source.connect(filter);
        filter.connect(this.bgmGain);
        source.start();
        this.bgmNodes.push(source, filter);
    }

    // ---- Volume / Mute ------------------------------------------------------

    setMuted(muted: boolean): void {
        this._muted = muted;
        localStorage.setItem(LS_KEY_MUTED, String(muted));
        if (this.sfxGain) this.sfxGain.gain.value = muted ? 0 : this._sfxVol;
        if (this.bgmGain) this.bgmGain.gain.value = muted ? 0 : this._bgmVol;
    }

    getBgmVolume(): number { return this._bgmVol; }
    getSfxVolume(): number { return this._sfxVol; }

    setBgmVolume(vol: number): void {
        this._bgmVol = Math.max(0, Math.min(1, vol));
        localStorage.setItem(LS_KEY_BGM_VOL, this._bgmVol.toString());
        if (this.bgmGain && !this._muted) {
            this.bgmGain.gain.value = this._bgmVol;
        }
    }

    setSfxVolume(vol: number): void {
        this._sfxVol = Math.max(0, Math.min(1, vol));
        localStorage.setItem(LS_KEY_SFX_VOL, this._sfxVol.toString());
        if (this.sfxGain && !this._muted) {
            this.sfxGain.gain.value = this._sfxVol;
        }
    }

    isMuted(): boolean { return this._muted; }
    isReady(): boolean { return this.ctx !== null; }
}
