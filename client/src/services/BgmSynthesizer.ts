/**
 * BgmSynthesizer — FM 합성 기반 프로시저럴 BGM 엔진.
 *
 * SoundManager에서 추출된 BGM 생성 책임을 담당.
 * 각 스테이지별 화음 진행 + FM 합성으로 풍부한 음색 생성.
 */

// 음계 주파수 (Hz)
const N = {
    C2: 65.41, G2: 98.00,
    C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00,
    C5: 523.25,
};

interface BgmConfig {
    chords: number[][];      // 화음 진행: 각 화음은 [root, 3rd, 5th]
    bpm: number;             // 템포 (beats per minute)
    beatsPerChord: number;   // 화음당 비트 수
    modRatio: number;        // FM 변조 비율 (modulator freq = carrier * ratio)
    modIndex: number;        // FM 변조 깊이
    volume: number;          // 마스터 볼륨 (0~1)
    bassOctave: number;      // 베이스 옥타브 배수 (0.5 = 한 옥타브 아래)
    lfoRate: number;         // 트레몰로 LFO 속도 (Hz)
    lfoDepth: number;        // 트레몰로 깊이 (0~1)
    filterFreq?: number;     // 로우패스 필터 (Hz, 없으면 미적용)
}

const CONFIGS: Record<string, BgmConfig> = {
    'bgm-menu': {
        chords: [[N.C4, N.E4, N.G4]],
        bpm: 60, beatsPerChord: 8,
        modRatio: 1, modIndex: 0.3, volume: 0.28,
        bassOctave: 0, lfoRate: 0, lfoDepth: 0,
    },
    'bgm-game': {
        chords: [
            [N.C4, N.E4, N.G4],
            [N.G3, N.B3, N.D4],
            [N.A3, N.C4, N.E4],
            [N.F3, N.A3, N.C4],
        ],
        bpm: 72, beatsPerChord: 4,
        modRatio: 2, modIndex: 0.8, volume: 0.22,
        bassOctave: 0.5, lfoRate: 2.5, lfoDepth: 0.4,
    },
    'bgm-forest': {
        chords: [
            [N.C4, N.E4, N.G4],   // I  (C)
            [N.G3, N.B3, N.D4],   // V  (G)
            [N.A3, N.C4, N.E4],   // vi (Am)
            [N.F3, N.A3, N.C4],   // IV (F)
        ],
        bpm: 84, beatsPerChord: 4,
        modRatio: 3, modIndex: 1.0, volume: 0.22,
        bassOctave: 0.5, lfoRate: 3.2, lfoDepth: 0.35,
        filterFreq: 2000,
    },
    'bgm-river': {
        chords: [
            [N.A3, N.C4, N.E4],   // vi (Am)
            [N.F3, N.A3, N.C4],   // IV (F)
            [N.C4, N.E4, N.G4],   // I  (C)
            [N.G3, N.B3, N.D4],   // V  (G)
        ],
        bpm: 60, beatsPerChord: 4,
        modRatio: 2, modIndex: 0.6, volume: 0.20,
        bassOctave: 0.5, lfoRate: 1.8, lfoDepth: 0.4,
        filterFreq: 1200,
    },
    'bgm-village': {
        chords: [
            [N.F3, N.A3, N.C4],   // IV (F)
            [N.C4, N.E4, N.G4],   // I  (C)
            [N.G3, N.B3, N.D4],   // V  (G)
            [N.A3, N.C4, N.E4],   // vi (Am)
        ],
        bpm: 66, beatsPerChord: 4,
        modRatio: 1.5, modIndex: 0.5, volume: 0.24,
        bassOctave: 0.5, lfoRate: 1.2, lfoDepth: 0.3,
    },
    'bgm-onsen-stage': {
        chords: [
            [N.C4, N.E4, N.G4],   // I  (C)
            [N.A3, N.C4, N.E4],   // vi (Am)
            [N.F3, N.A3, N.C4],   // IV (F)
            [N.G3, N.B3, N.D4],   // V  (G)
        ],
        bpm: 48, beatsPerChord: 4,
        modRatio: 1, modIndex: 0.3, volume: 0.20,
        bassOctave: 0.25, lfoRate: 0.6, lfoDepth: 0.25,
        filterFreq: 800,
    },
};

export class BgmSynthesizer {
    private chordTimer: ReturnType<typeof setInterval> | null = null;
    private carriers: OscillatorNode[] = [];
    private bassCarrier: OscillatorNode | null = null;

    /**
     * 지정된 BGM 스타일의 FM 합성 노드를 생성하여 반환.
     * 반환된 AudioNode[]는 SoundManager.bgmNodes에 저장됨.
     */
    create(name: string, ctx: AudioContext, output: GainNode): AudioNode[] | null {
        const config = CONFIGS[name];
        if (!config) return null;

        this.cleanup();
        const nodes: AudioNode[] = [];
        const chord = config.chords[0];
        const t = ctx.currentTime;

        // FM 합성 보이스 (화음의 각 음)
        for (const freq of chord) {
            const { carrier, allNodes } = this.createFMVoice(ctx, output, freq, config, t);
            this.carriers.push(carrier);
            nodes.push(...allNodes);
        }

        // 베이스 (루트 음의 하위 옥타브)
        if (config.bassOctave > 0) {
            const bassFreq = chord[0] * config.bassOctave;
            const bass = ctx.createOscillator();
            bass.type = 'sine';
            bass.frequency.setValueAtTime(bassFreq, t);
            const bassGain = ctx.createGain();
            bassGain.gain.setValueAtTime(config.volume * 0.4, t);
            bass.connect(bassGain);
            bassGain.connect(output);
            try { bass.start(t); } catch { /* closed context */ }
            this.bassCarrier = bass;
            nodes.push(bass, bassGain);
        }

        // 트레몰로 LFO (전체 볼륨 진동)
        if (config.lfoRate > 0) {
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(config.lfoRate, t);
            const lfoGain = ctx.createGain();
            lfoGain.gain.setValueAtTime(config.lfoDepth, t);
            lfo.connect(lfoGain);
            // LFO가 각 carrier의 gain에 영향 → 트레몰로
            lfoGain.connect(output.gain);
            try { lfo.start(t); } catch { /* closed context */ }
            nodes.push(lfo, lfoGain);
        }

        // 화음 진행 타이머 (2개 이상 화음)
        if (config.chords.length > 1) {
            const msPerChord = (60000 / config.bpm) * config.beatsPerChord;
            let idx = 0;
            this.chordTimer = setInterval(() => {
                idx = (idx + 1) % config.chords.length;
                const next = config.chords[idx];
                const now = ctx.currentTime;
                // 부드러운 주파수 전환 (time constant 0.3초)
                this.carriers.forEach((c, i) => {
                    if (i < next.length) {
                        c.frequency.setTargetAtTime(next[i], now, 0.3);
                    }
                });
                // 베이스도 루트 추종
                if (this.bassCarrier && config.bassOctave > 0) {
                    this.bassCarrier.frequency.setTargetAtTime(
                        next[0] * config.bassOctave, now, 0.3,
                    );
                }
            }, msPerChord);
        }

        return nodes;
    }

    /** FM 합성 보이스 생성 (캐리어 + 모듈레이터) */
    private createFMVoice(
        ctx: AudioContext, output: GainNode,
        freq: number, config: BgmConfig, t: number,
    ): { carrier: OscillatorNode; allNodes: AudioNode[] } {
        const nodes: AudioNode[] = [];

        // 모듈레이터
        const mod = ctx.createOscillator();
        mod.type = 'sine';
        mod.frequency.setValueAtTime(freq * config.modRatio, t);
        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(freq * config.modIndex, t);
        mod.connect(modGain);
        nodes.push(mod, modGain);

        // 캐리어 (FM 연결: modGain → carrier.frequency)
        const carrier = ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(freq, t);
        modGain.connect(carrier.frequency);

        // 옵셔널 로우패스 필터
        let lastNode: AudioNode = carrier;
        if (config.filterFreq) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(config.filterFreq, t);
            filter.Q.setValueAtTime(0.7, t);
            carrier.connect(filter);
            lastNode = filter;
            nodes.push(filter);
        }

        // 보이스 볼륨
        const voiceGain = ctx.createGain();
        const vol = config.volume / config.chords[0].length;
        voiceGain.gain.setValueAtTime(vol, t);
        lastNode.connect(voiceGain);
        voiceGain.connect(output);

        try { mod.start(t); } catch { /* closed context */ }
        try { carrier.start(t); } catch { /* closed context */ }
        nodes.push(carrier, voiceGain);

        return { carrier, allNodes: nodes };
    }

    /** 화음 타이머 정리 (노드 정리는 SoundManager.stopBgm()이 담당) */
    cleanup(): void {
        if (this.chordTimer) {
            clearInterval(this.chordTimer);
            this.chordTimer = null;
        }
        this.carriers = [];
        this.bassCarrier = null;
    }
}
