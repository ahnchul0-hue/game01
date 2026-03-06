// Procedural Web Audio API sound engine for Capybara Runner (no audio files).

export type SfxName = 'jump' | 'slide' | 'collect' | 'collect_rare' | 'hit' | 'powerup' | 'button' | 'gameover' | 'levelup' | 'move' | 'revive' | 'nearmiss';
export type BgmName = 'bgm-menu' | 'bgm-game' | 'bgm-onsen'
    | 'bgm-forest' | 'bgm-river' | 'bgm-village' | 'bgm-onsen-stage';
export type AmbientName = 'ambient-birds' | 'ambient-stream' | 'ambient-wind' | 'ambient-rain';

const LS_KEY_MUTED = 'capybara_muted';
const LS_KEY_BGM_VOL = 'capybara_bgm_vol';
const LS_KEY_SFX_VOL = 'capybara_sfx_vol';
const LS_KEY_AMBIENT_VOL = 'capybara_ambient_vol';
let _instance: SoundManager | null = null;

export class SoundManager {
    private ctx: AudioContext | null = null;
    private sfxGain: GainNode | null = null;
    private bgmGain: GainNode | null = null;
    private ambientGain: GainNode | null = null;
    private bgmNodes: AudioNode[] = [];
    private ambientNodes: AudioNode[] = [];
    private muted: boolean;
    private bgmVol: number;
    private sfxVol: number;
    private ambientVol: number;
    private hitNoiseBuffer: AudioBuffer | null = null;
    private onsenNoiseBuffer: AudioBuffer | null = null;

    private constructor() {
        this.muted = localStorage.getItem(LS_KEY_MUTED) === 'true';
        this.bgmVol = parseFloat(localStorage.getItem(LS_KEY_BGM_VOL) ?? '0.18');
        this.sfxVol = parseFloat(localStorage.getItem(LS_KEY_SFX_VOL) ?? '0.6');
        this.ambientVol = parseFloat(localStorage.getItem(LS_KEY_AMBIENT_VOL) ?? '0.35');
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
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = this.muted ? 0 : this.ambientVol;
        this.ambientGain.connect(this.ctx.destination);
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

    // ---- Ambient (ASMR Soundscape) ------------------------------------------

    playAmbient(name: AmbientName): void {
        if (!this.ctx || !this.ambientGain) return;
        this.stopAmbient();
        switch (name) {
            case 'ambient-birds':  this.createAmbientBirds();  break;
            case 'ambient-stream': this.createAmbientStream(); break;
            case 'ambient-wind':   this.createAmbientWind();   break;
            case 'ambient-rain':   this.createAmbientRain();   break;
        }
    }

    stopAmbient(): void {
        for (const node of this.ambientNodes) {
            if ('stop' in node && typeof (node as any).stop === 'function') {
                try { (node as OscillatorNode | AudioBufferSourceNode).stop(); } catch { /* already stopped */ }
            }
            try { node.disconnect(); } catch { /* already disconnected */ }
        }
        this.ambientNodes = [];
    }

    /** 일시정지: 노드 유지한 채 볼륨만 페이드아웃 */
    pauseAmbient(): void {
        if (this.ambientGain && this.ctx) {
            const t = this.ctx.currentTime;
            this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, t);
            this.ambientGain.gain.linearRampToValueAtTime(0, t + 0.1);
        }
    }

    /** 재개: 볼륨 페이드인 (노드 재생성 없음) */
    resumeAmbient(): void {
        if (this.ambientGain && this.ctx && !this.muted) {
            const t = this.ctx.currentTime;
            this.ambientGain.gain.setValueAtTime(0, t);
            this.ambientGain.gain.linearRampToValueAtTime(this.ambientVol, t + 0.1);
        }
    }

    /** 새소리: 고음 사인파 트릴 + 랜덤 간격 반복 */
    private createAmbientBirds(): void {
        if (!this.ctx || !this.ambientGain) return;

        // 새소리 주파수 (다양한 새 시뮬레이션)
        const birdFreqs = [1200, 1500, 1800, 2200, 1600];
        const masterGain = this.ctx.createGain();
        masterGain.gain.value = 0.6;
        masterGain.connect(this.ambientGain);

        for (const freq of birdFreqs) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            // 랜덤 트릴: 주파수를 LFO로 미세 변조
            const trill = this.ctx.createOscillator();
            trill.type = 'sine';
            trill.frequency.value = 4 + Math.random() * 8; // 4~12Hz 트릴

            const trillGain = this.ctx.createGain();
            trillGain.gain.value = freq * 0.03; // 주파수의 3% 변조
            trill.connect(trillGain);
            trillGain.connect(osc.frequency);

            // 볼륨 LFO: 느리게 나타났다 사라짐 (자연스러운 새소리)
            const volLfo = this.ctx.createOscillator();
            volLfo.type = 'sine';
            volLfo.frequency.value = 0.1 + Math.random() * 0.3; // 0.1~0.4Hz

            const volLfoGain = this.ctx.createGain();
            volLfoGain.gain.value = 0.04;
            volLfo.connect(volLfoGain);

            const envGain = this.ctx.createGain();
            envGain.gain.value = 0.02;
            volLfoGain.connect(envGain.gain);
            osc.connect(envGain);
            envGain.connect(masterGain);

            osc.start(); trill.start(); volLfo.start();
            this.ambientNodes.push(osc, trill, trillGain, volLfo, volLfoGain, envGain);
        }
        this.ambientNodes.push(masterGain);
    }

    /** 시냇물: 밴드패스 노이즈 + 저주파 물방울 톤 */
    private createAmbientStream(): void {
        if (!this.ctx || !this.ambientGain) return;

        if (!this.onsenNoiseBuffer) {
            const bufSize = this.ctx.sampleRate * 4;
            this.onsenNoiseBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = this.onsenNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        }

        // 메인 물소리 (저역 밴드패스)
        const water = this.ctx.createBufferSource();
        water.buffer = this.onsenNoiseBuffer;
        water.loop = true;
        const waterFilter = this.ctx.createBiquadFilter();
        waterFilter.type = 'bandpass';
        waterFilter.frequency.value = 400;
        waterFilter.Q.value = 0.6;
        const waterGain = this.ctx.createGain();
        waterGain.gain.value = 0.5;
        water.connect(waterFilter);
        waterFilter.connect(waterGain);
        waterGain.connect(this.ambientGain);

        // 고역 졸졸 소리 (작은 물방울)
        const ripple = this.ctx.createBufferSource();
        ripple.buffer = this.onsenNoiseBuffer;
        ripple.loop = true;
        const rippleFilter = this.ctx.createBiquadFilter();
        rippleFilter.type = 'bandpass';
        rippleFilter.frequency.value = 2500;
        rippleFilter.Q.value = 2.0;
        // 볼륨 흔들림 (자연스러운 물결)
        const rippleLfo = this.ctx.createOscillator();
        rippleLfo.type = 'sine';
        rippleLfo.frequency.value = 0.3;
        const rippleLfoGain = this.ctx.createGain();
        rippleLfoGain.gain.value = 0.04;
        rippleLfo.connect(rippleLfoGain);
        const rippleGain = this.ctx.createGain();
        rippleGain.gain.value = 0.08;
        rippleLfoGain.connect(rippleGain.gain);
        ripple.connect(rippleFilter);
        rippleFilter.connect(rippleGain);
        rippleGain.connect(this.ambientGain);

        water.start(); ripple.start(); rippleLfo.start();
        this.ambientNodes.push(
            water, waterFilter, waterGain,
            ripple, rippleFilter, rippleLfo, rippleLfoGain, rippleGain,
        );
    }

    /** 바람: 저주파 밴드패스 노이즈 + 느린 볼륨 스월 */
    private createAmbientWind(): void {
        if (!this.ctx || !this.ambientGain) return;

        if (!this.onsenNoiseBuffer) {
            const bufSize = this.ctx.sampleRate * 4;
            this.onsenNoiseBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = this.onsenNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        }

        const wind = this.ctx.createBufferSource();
        wind.buffer = this.onsenNoiseBuffer;
        wind.loop = true;

        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 500;
        windFilter.Q.value = 0.3;

        // 느린 필터 스위프 (바람 세기 변화)
        const sweepLfo = this.ctx.createOscillator();
        sweepLfo.type = 'sine';
        sweepLfo.frequency.value = 0.08; // ~12초 주기
        const sweepGain = this.ctx.createGain();
        sweepGain.gain.value = 300;
        sweepLfo.connect(sweepGain);
        sweepGain.connect(windFilter.frequency);

        // 볼륨 스월 (바람이 불었다 잦아짐)
        const volLfo = this.ctx.createOscillator();
        volLfo.type = 'sine';
        volLfo.frequency.value = 0.05; // ~20초 주기
        const volLfoGain = this.ctx.createGain();
        volLfoGain.gain.value = 0.2;
        volLfo.connect(volLfoGain);
        const windGain = this.ctx.createGain();
        windGain.gain.value = 0.4;
        volLfoGain.connect(windGain.gain);

        wind.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(this.ambientGain);

        wind.start(); sweepLfo.start(); volLfo.start();
        this.ambientNodes.push(
            wind, windFilter,
            sweepLfo, sweepGain,
            volLfo, volLfoGain, windGain,
        );
    }

    /** 비: 고밀도 노이즈 + 빗방울 톤 */
    private createAmbientRain(): void {
        if (!this.ctx || !this.ambientGain) return;

        if (!this.onsenNoiseBuffer) {
            const bufSize = this.ctx.sampleRate * 4;
            this.onsenNoiseBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = this.onsenNoiseBuffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        }

        // 비 배경 (핑크 노이즈 근사: 로우패스 + 하이패스 조합)
        const rain = this.ctx.createBufferSource();
        rain.buffer = this.onsenNoiseBuffer;
        rain.loop = true;
        const lpf = this.ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 4000;
        const hpf = this.ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 200;
        const rainGain = this.ctx.createGain();
        rainGain.gain.value = 0.35;
        rain.connect(lpf);
        lpf.connect(hpf);
        hpf.connect(rainGain);
        rainGain.connect(this.ambientGain);

        // 빗방울 "틱틱" — 고음 클릭 패턴 (랜덤 볼륨 LFO)
        const drip = this.ctx.createOscillator();
        drip.type = 'sine';
        drip.frequency.value = 3500;
        const dripLfo = this.ctx.createOscillator();
        dripLfo.type = 'square'; // on/off 패턴
        dripLfo.frequency.value = 6 + Math.random() * 4; // 6~10Hz 빗방울 밀도
        const dripLfoGain = this.ctx.createGain();
        dripLfoGain.gain.value = 0.015;
        dripLfo.connect(dripLfoGain);
        const dripGain = this.ctx.createGain();
        dripGain.gain.value = 0.01;
        dripLfoGain.connect(dripGain.gain);
        drip.connect(dripGain);
        dripGain.connect(this.ambientGain);

        rain.start(); drip.start(); dripLfo.start();
        this.ambientNodes.push(
            rain, lpf, hpf, rainGain,
            drip, dripLfo, dripLfoGain, dripGain,
        );
    }

    // ---- Volume / Mute ------------------------------------------------------

    /** 볼륨 변경 시 클릭 방지 ramp */
    private rampGain(gain: GainNode, target: number): void {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(target, t + 0.03);
    }

    setMuted(muted: boolean): void {
        this.muted = muted;
        localStorage.setItem(LS_KEY_MUTED, String(muted));
        if (this.sfxGain) this.rampGain(this.sfxGain, muted ? 0 : this.sfxVol);
        if (this.bgmGain) this.rampGain(this.bgmGain, muted ? 0 : this.bgmVol);
        if (this.ambientGain) this.rampGain(this.ambientGain, muted ? 0 : this.ambientVol);
    }

    getBgmVolume(): number { return this.bgmVol; }
    getSfxVolume(): number { return this.sfxVol; }

    setBgmVolume(vol: number): void {
        this.bgmVol = Math.max(0, Math.min(1, vol));
        localStorage.setItem(LS_KEY_BGM_VOL, this.bgmVol.toString());
        if (this.bgmGain && !this.muted) {
            this.rampGain(this.bgmGain, this.bgmVol);
        }
    }

    setSfxVolume(vol: number): void {
        this.sfxVol = Math.max(0, Math.min(1, vol));
        localStorage.setItem(LS_KEY_SFX_VOL, this.sfxVol.toString());
        if (this.sfxGain && !this.muted) {
            this.rampGain(this.sfxGain, this.sfxVol);
        }
    }

    getAmbientVolume(): number { return this.ambientVol; }

    setAmbientVolume(vol: number): void {
        this.ambientVol = Math.max(0, Math.min(1, vol));
        localStorage.setItem(LS_KEY_AMBIENT_VOL, this.ambientVol.toString());
        if (this.ambientGain && !this.muted) {
            this.rampGain(this.ambientGain, this.ambientVol);
        }
    }

    isMuted(): boolean { return this.muted; }
    isReady(): boolean { return this.ctx !== null; }
}
