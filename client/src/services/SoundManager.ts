// Procedural Web Audio API sound engine for Capybara Runner (no audio files).

export type SfxName = 'jump' | 'slide' | 'collect' | 'collect_rare' | 'hit' | 'powerup' | 'button' | 'gameover' | 'levelup' | 'move' | 'revive' | 'nearmiss';
export type BgmName = 'bgm-menu' | 'bgm-game' | 'bgm-onsen'
    | 'bgm-forest' | 'bgm-river' | 'bgm-village' | 'bgm-onsen-stage';

const LS_KEY_MUTED = 'capybara_muted';
const LS_KEY_BGM_VOL = 'capybara_bgm_vol';
const LS_KEY_SFX_VOL = 'capybara_sfx_vol';
let _instance: SoundManager | null = null;

export class SoundManager {
    private ctx: AudioContext | null = null;
    private sfxGain: GainNode | null = null;
    private bgmGain: GainNode | null = null;
    private bgmNodes: AudioNode[] = [];
    private muted: boolean;
    private bgmVol: number;
    private sfxVol: number;
    private hitNoiseBuffer: AudioBuffer | null = null;
    private onsenNoiseBuffer: AudioBuffer | null = null;

    private constructor() {
        this.muted = localStorage.getItem(LS_KEY_MUTED) === 'true';
        this.bgmVol = parseFloat(localStorage.getItem(LS_KEY_BGM_VOL) ?? '0.18');
        this.sfxVol = parseFloat(localStorage.getItem(LS_KEY_SFX_VOL) ?? '0.6');
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
        this.sfxGain.gain.value = this.muted ? 0 : this.sfxVol;
        this.sfxGain.connect(this.ctx.destination);
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this.muted ? 0 : this.bgmVol;
        this.bgmGain.connect(this.ctx.destination);
    }

    // ---- SFX ----------------------------------------------------------------

    playSfx(name: SfxName): void {
        if (!this.ctx || !this.sfxGain || this.muted) return;
        switch (name) {
            case 'jump':     this.playTone('sine',     440,  0.08, 660);  break;
            case 'slide':    this.playTone('sawtooth', 220,  0.12, 110);  break;
            case 'collect':  this.playSfxCollect();                       break;
            case 'hit':      this.playSfxHit();                           break;
            case 'powerup':  this.playTone('sine',     660,  0.25, 1320); break;
            case 'button':   this.playTone('sine',     600,  0.04);       break;
            case 'gameover': this.playTone('sine',     440,  0.4,  220);  break;
            case 'levelup':  this.playSfxLevelup();                       break;
            case 'move':        this.playTone('sine', 800, 0.03);         break;
            case 'revive':      this.playSfxRevive();                     break;
            case 'collect_rare': this.playSfxCollectRare();               break;
            case 'nearmiss':     this.playSfxNearMiss();                break;
        }
    }

    private now(): number {
        if (!this.ctx) return 0;
        return this.ctx.currentTime;
    }

    /** Schedule one oscillator tone with exponential fade-out. */
    private playTone(
        type: OscillatorType, freq: number, dur: number,
        freqEnd?: number, at: number = this.now(),
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

    private playSfxCollect(): void {
        const t = this.now();
        this.playTone('sine', 523, 0.1, undefined, t);
        this.playTone('sine', 659, 0.1, undefined, t + 0.1);
    }

    private playSfxHit(): void {
        if (!this.ctx || !this.sfxGain) return;
        const t = this.now();
        this.playTone('square', 150, 0.15, 80, t);
        // Cached noise buffer for impact texture (avoid per-call allocation)
        if (!this.hitNoiseBuffer) {
            const bufSize = Math.floor(this.ctx.sampleRate * 0.12);
            this.hitNoiseBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = this.hitNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.hitNoiseBuffer;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        noise.connect(g);
        g.connect(this.sfxGain);
        noise.start(t);
    }

    private playSfxLevelup(): void {
        const t = this.now();
        [523, 659, 784].forEach((f, i) => this.playTone('sine', f, 0.08, undefined, t + i * 0.08));
    }

    private playSfxRevive(): void {
        const t = this.now();
        [392, 523, 659].forEach((f, i) => this.playTone('sine', f, 0.1, undefined, t + i * 0.1));
    }

    private playSfxCollectRare(): void {
        const t = this.now();
        this.playTone('sine', 523, 0.08, undefined, t);
        this.playTone('sine', 659, 0.08, undefined, t + 0.08);
        this.playTone('sine', 784, 0.12, undefined, t + 0.16);
    }

    /** A3: 니어미스 swoosh — 고주파 주파수 스위프 */
    private playSfxNearMiss(): void {
        const t = this.now();
        this.playTone('sine', 1200, 0.08, 400, t);
    }

    /** A2: 콤보 히트 SFX — 콤보 단계별 피치 상승 */
    playComboHit(count: number): void {
        if (!this.ctx || !this.sfxGain || this.muted) return;
        const t = this.now();
        if (count >= 7) {
            // 팡파르 (3음 화음)
            this.playTone('sine', 659, 0.06, undefined, t);
            this.playTone('sine', 784, 0.06, undefined, t + 0.05);
            this.playTone('sine', 1047, 0.1, undefined, t + 0.1);
        } else if (count >= 5) {
            // 징글 (2음)
            this.playTone('sine', 659, 0.06, undefined, t);
            this.playTone('sine', 880, 0.08, undefined, t + 0.06);
        } else if (count >= 3) {
            // 딩 (1음 밝은 톤)
            this.playTone('sine', 784, 0.08, undefined, t);
        }
    }

    // ---- BGM ----------------------------------------------------------------

    playBgm(name: BgmName): void {
        if (!this.ctx || !this.bgmGain) return;
        this.stopBgm();
        switch (name) {
            case 'bgm-menu':         this.createBgmMenu();          break;
            case 'bgm-game':         this.createBgmGame();          break;
            case 'bgm-onsen':        this.createBgmOnsen();         break;
            // 스테이지별 BGM
            case 'bgm-forest':       this.createBgmForest();        break;
            case 'bgm-river':        this.createBgmRiver();         break;
            case 'bgm-village':      this.createBgmVillage();       break;
            case 'bgm-onsen-stage':  this.createBgmOnsenStage();    break;
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
    private createBgmMenu(): void {
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
    private createBgmGame(): void {
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
    private createBgmOnsen(): void {
        if (!this.ctx || !this.bgmGain) return;
        // Cached 4-second noise buffer (avoid per-call allocation)
        if (!this.onsenNoiseBuffer) {
            const bufSize = this.ctx.sampleRate * 4;
            this.onsenNoiseBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = this.onsenNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.onsenNoiseBuffer;
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

    /**
     * 숲속(forest): 밝고 경쾌한 BGM.
     * 베이스 드론(110Hz) + 빠른 LFO(3.2Hz) + 고음 하모닉(330Hz, 삼각파) 조합.
     */
    private createBgmForest(): void {
        if (!this.ctx || !this.bgmGain) return;

        // 베이스 드론 (bgm-game과 유사하지만 LFO가 조금 더 빠름)
        const drone = this.ctx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = 110;

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 3.2; // 빠른 리듬감 (경쾌함)

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.5;
        lfo.connect(lfoGain);

        const pulseGain = this.ctx.createGain();
        pulseGain.gain.value = 0.5;
        lfoGain.connect(pulseGain.gain);
        drone.connect(pulseGain);
        pulseGain.connect(this.bgmGain);

        // 밝은 고음 하모닉 (삼각파 330Hz: 숲속의 경쾌함)
        const harmonic = this.ctx.createOscillator();
        harmonic.type = 'triangle';
        harmonic.frequency.value = 330;

        const harmonicGain = this.ctx.createGain();
        harmonicGain.gain.value = 0.18;
        harmonic.connect(harmonicGain);
        harmonicGain.connect(this.bgmGain);

        // 고주파 하모닉 LFO (새소리 느낌)
        const birdLfo = this.ctx.createOscillator();
        birdLfo.type = 'sine';
        birdLfo.frequency.value = 0.8;

        const birdLfoGain = this.ctx.createGain();
        birdLfoGain.gain.value = 0.06;
        birdLfo.connect(birdLfoGain);
        birdLfoGain.connect(harmonicGain.gain);

        drone.start(); lfo.start(); harmonic.start(); birdLfo.start();
        this.bgmNodes.push(drone, lfo, lfoGain, pulseGain, harmonic, harmonicGain, birdLfo, birdLfoGain);
    }

    /**
     * 강가(river): 물 흐르는 느낌의 약간 어두운 톤.
     * 저음 드론(82Hz) + 느린 LFO(1.8Hz) + 밴드패스 노이즈(물소리).
     */
    private createBgmRiver(): void {
        if (!this.ctx || !this.bgmGain) return;

        // 저음 드론 (약간 어두운 톤)
        const drone = this.ctx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = 82; // E2: 어둡고 깊은 느낌

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 1.8; // 느린 흔들림

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.45;
        lfo.connect(lfoGain);

        const pulseGain = this.ctx.createGain();
        pulseGain.gain.value = 0.45;
        lfoGain.connect(pulseGain.gain);
        drone.connect(pulseGain);
        pulseGain.connect(this.bgmGain);

        // 물소리 텍스처: 저주파 밴드패스 노이즈
        if (!this.onsenNoiseBuffer) {
            const bufSize = this.ctx.sampleRate * 4;
            this.onsenNoiseBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = this.onsenNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        }
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.onsenNoiseBuffer;
        noiseSource.loop = true;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 350; // 저주파 물 흐름
        noiseFilter.Q.value = 1.2;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.12;

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.bgmGain);

        // 중음 서브 하모닉 (강의 깊이감)
        const sub = this.ctx.createOscillator();
        sub.type = 'triangle';
        sub.frequency.value = 164; // E3

        const subGain = this.ctx.createGain();
        subGain.gain.value = 0.12;
        sub.connect(subGain);
        subGain.connect(this.bgmGain);

        drone.start(); lfo.start(); noiseSource.start(); sub.start();
        this.bgmNodes.push(
            drone, lfo, lfoGain, pulseGain,
            noiseSource, noiseFilter, noiseGain,
            sub, subGain,
        );
    }

    /**
     * 마을(village): 웅장하고 따뜻한 느낌.
     * 베이스 드론(130Hz) + 느린 LFO(1.2Hz) + 5도 화음(195Hz) + 고음 삼각파(390Hz).
     */
    private createBgmVillage(): void {
        if (!this.ctx || !this.bgmGain) return;

        // 베이스 드론 C3 (웅장함)
        const drone = this.ctx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = 130.81; // C3

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 1.2; // 느리고 장중한 박동

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.4;
        lfo.connect(lfoGain);

        const pulseGain = this.ctx.createGain();
        pulseGain.gain.value = 0.55;
        lfoGain.connect(pulseGain.gain);
        drone.connect(pulseGain);
        pulseGain.connect(this.bgmGain);

        // 5도 화음 G3 (웅장한 느낌 강화)
        const fifth = this.ctx.createOscillator();
        fifth.type = 'sine';
        fifth.frequency.value = 196.0; // G3

        const fifthGain = this.ctx.createGain();
        fifthGain.gain.value = 0.22;
        fifth.connect(fifthGain);
        fifthGain.connect(this.bgmGain);

        // 옥타브 하모닉 C4 (따뜻한 마을 느낌)
        const octave = this.ctx.createOscillator();
        octave.type = 'triangle';
        octave.frequency.value = 261.63; // C4

        // 느린 LFO로 옥타브 볼륨 진동 (마을 종소리 느낌)
        const bellLfo = this.ctx.createOscillator();
        bellLfo.type = 'sine';
        bellLfo.frequency.value = 0.5;

        const bellLfoGain = this.ctx.createGain();
        bellLfoGain.gain.value = 0.07;
        bellLfo.connect(bellLfoGain);

        const octaveGain = this.ctx.createGain();
        octaveGain.gain.value = 0.15;
        bellLfoGain.connect(octaveGain.gain);
        octave.connect(octaveGain);
        octaveGain.connect(this.bgmGain);

        drone.start(); lfo.start(); fifth.start(); octave.start(); bellLfo.start();
        this.bgmNodes.push(
            drone, lfo, lfoGain, pulseGain,
            fifth, fifthGain,
            octave, octaveGain, bellLfo, bellLfoGain,
        );
    }

    /**
     * 온천 스테이지(onsen-stage): 릴렉싱하고 몽환적인 느낌.
     * 저주파 드론(65Hz) + 매우 느린 LFO(0.6Hz) + 밴드패스 노이즈(물 김) + 고음 사인파(523Hz).
     */
    private createBgmOnsenStage(): void {
        if (!this.ctx || !this.bgmGain) return;

        // 깊은 저음 드론 C2 (릴렉스)
        const drone = this.ctx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = 65.41; // C2

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.6; // 매우 느린 호흡감

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.35;
        lfo.connect(lfoGain);

        const pulseGain = this.ctx.createGain();
        pulseGain.gain.value = 0.5;
        lfoGain.connect(pulseGain.gain);
        drone.connect(pulseGain);
        pulseGain.connect(this.bgmGain);

        // 온천 수증기: 고주파 밴드패스 노이즈
        if (!this.onsenNoiseBuffer) {
            const bufSize = this.ctx.sampleRate * 4;
            this.onsenNoiseBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = this.onsenNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        }
        const steamSource = this.ctx.createBufferSource();
        steamSource.buffer = this.onsenNoiseBuffer;
        steamSource.loop = true;

        const steamFilter = this.ctx.createBiquadFilter();
        steamFilter.type = 'bandpass';
        steamFilter.frequency.value = 800; // 수증기 소리
        steamFilter.Q.value = 0.6;

        const steamGain = this.ctx.createGain();
        steamGain.gain.value = 0.09;

        steamSource.connect(steamFilter);
        steamFilter.connect(steamGain);
        steamGain.connect(this.bgmGain);

        // 몽환적인 고음 (C5: 풍경 소리 느낌)
        const chime = this.ctx.createOscillator();
        chime.type = 'sine';
        chime.frequency.value = 523.25; // C5

        // 매우 느린 볼륨 LFO (은은하게 나타났다 사라짐)
        const chimeLfo = this.ctx.createOscillator();
        chimeLfo.type = 'sine';
        chimeLfo.frequency.value = 0.3;

        const chimeLfoGain = this.ctx.createGain();
        chimeLfoGain.gain.value = 0.04;
        chimeLfo.connect(chimeLfoGain);

        const chimeGain = this.ctx.createGain();
        chimeGain.gain.value = 0.06;
        chimeLfoGain.connect(chimeGain.gain);
        chime.connect(chimeGain);
        chimeGain.connect(this.bgmGain);

        // 5도 화음 G2 (아늑함 강화)
        const fifth = this.ctx.createOscillator();
        fifth.type = 'sine';
        fifth.frequency.value = 98.0; // G2

        const fifthGain = this.ctx.createGain();
        fifthGain.gain.value = 0.14;
        fifth.connect(fifthGain);
        fifthGain.connect(this.bgmGain);

        drone.start(); lfo.start(); steamSource.start(); chime.start(); chimeLfo.start(); fifth.start();
        this.bgmNodes.push(
            drone, lfo, lfoGain, pulseGain,
            steamSource, steamFilter, steamGain,
            chime, chimeGain, chimeLfo, chimeLfoGain,
            fifth, fifthGain,
        );
    }

    // ---- Volume / Mute ------------------------------------------------------

    setMuted(muted: boolean): void {
        this.muted = muted;
        localStorage.setItem(LS_KEY_MUTED, String(muted));
        if (this.sfxGain) this.sfxGain.gain.value = muted ? 0 : this.sfxVol;
        if (this.bgmGain) this.bgmGain.gain.value = muted ? 0 : this.bgmVol;
    }

    getBgmVolume(): number { return this.bgmVol; }
    getSfxVolume(): number { return this.sfxVol; }

    setBgmVolume(vol: number): void {
        this.bgmVol = Math.max(0, Math.min(1, vol));
        localStorage.setItem(LS_KEY_BGM_VOL, this.bgmVol.toString());
        if (this.bgmGain && !this.muted) {
            this.bgmGain.gain.value = this.bgmVol;
        }
    }

    setSfxVolume(vol: number): void {
        this.sfxVol = Math.max(0, Math.min(1, vol));
        localStorage.setItem(LS_KEY_SFX_VOL, this.sfxVol.toString());
        if (this.sfxGain && !this.muted) {
            this.sfxGain.gain.value = this.sfxVol;
        }
    }

    isMuted(): boolean { return this.muted; }
    isReady(): boolean { return this.ctx !== null; }
}
