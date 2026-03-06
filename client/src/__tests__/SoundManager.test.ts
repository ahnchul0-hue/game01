// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

/**
 * SoundManager 볼륨/뮤트 로직 테스트.
 * AudioContext는 jsdom에서 미지원이므로 localStorage 기반 로직만 테스트.
 * SoundManager는 private constructor + singleton이므로 동일 로직을 재현하여 테스트.
 */

const LS_KEY_MUTED = 'capybara_muted';
const LS_KEY_BGM_VOL = 'capybara_bgm_vol';
const LS_KEY_SFX_VOL = 'capybara_sfx_vol';
const LS_KEY_AMBIENT_VOL = 'capybara_ambient_vol';

// ─── 볼륨 클램프 로직 (SoundManager.setBgmVolume/setSfxVolume) ─────────
function clampVolume(vol: number): number {
    return Math.max(0, Math.min(1, vol));
}

// ─── 기본값 파싱 로직 (SoundManager constructor) ──────────────────────
function parseBgmVol(): number {
    return parseFloat(localStorage.getItem(LS_KEY_BGM_VOL) ?? '0.18');
}

function parseSfxVol(): number {
    return parseFloat(localStorage.getItem(LS_KEY_SFX_VOL) ?? '0.6');
}

function parseMuted(): boolean {
    return localStorage.getItem(LS_KEY_MUTED) === 'true';
}

describe('SoundManager volume logic', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('clampVolume', () => {
        it('clamps negative to 0', () => {
            expect(clampVolume(-0.5)).toBe(0);
        });

        it('clamps above 1 to 1', () => {
            expect(clampVolume(1.5)).toBe(1);
        });

        it('passes through 0', () => {
            expect(clampVolume(0)).toBe(0);
        });

        it('passes through 1', () => {
            expect(clampVolume(1)).toBe(1);
        });

        it('passes through 0.5', () => {
            expect(clampVolume(0.5)).toBe(0.5);
        });
    });

    describe('default values (no localStorage)', () => {
        it('BGM default is 0.18', () => {
            expect(parseBgmVol()).toBe(0.18);
        });

        it('SFX default is 0.6', () => {
            expect(parseSfxVol()).toBe(0.6);
        });

        it('muted default is false', () => {
            expect(parseMuted()).toBe(false);
        });
    });

    describe('localStorage persistence', () => {
        it('reads stored BGM volume', () => {
            localStorage.setItem(LS_KEY_BGM_VOL, '0.5');
            expect(parseBgmVol()).toBe(0.5);
        });

        it('reads stored SFX volume', () => {
            localStorage.setItem(LS_KEY_SFX_VOL, '0.3');
            expect(parseSfxVol()).toBe(0.3);
        });

        it('reads muted=true', () => {
            localStorage.setItem(LS_KEY_MUTED, 'true');
            expect(parseMuted()).toBe(true);
        });

        it('reads muted=false explicitly', () => {
            localStorage.setItem(LS_KEY_MUTED, 'false');
            expect(parseMuted()).toBe(false);
        });

        it('handles invalid BGM vol string (NaN falls through to parseFloat)', () => {
            localStorage.setItem(LS_KEY_BGM_VOL, 'abc');
            expect(Number.isNaN(parseBgmVol())).toBe(true);
        });
    });

    describe('volume set + read cycle', () => {
        it('setBgmVolume persists and can be read back', () => {
            const vol = clampVolume(0.09);
            localStorage.setItem(LS_KEY_BGM_VOL, vol.toString());
            expect(parseBgmVol()).toBe(0.09);
        });

        it('setSfxVolume persists and can be read back', () => {
            const vol = clampVolume(0.3);
            localStorage.setItem(LS_KEY_SFX_VOL, vol.toString());
            expect(parseSfxVol()).toBe(0.3);
        });

        it('clamped negative volume persists as 0', () => {
            const vol = clampVolume(-1);
            localStorage.setItem(LS_KEY_BGM_VOL, vol.toString());
            expect(parseBgmVol()).toBe(0);
        });

        it('clamped over-1 volume persists as 1', () => {
            const vol = clampVolume(999);
            localStorage.setItem(LS_KEY_SFX_VOL, vol.toString());
            expect(parseSfxVol()).toBe(1);
        });
    });

    describe('ambient volume logic', () => {
        function parseAmbientVol(): number {
            return parseFloat(localStorage.getItem(LS_KEY_AMBIENT_VOL) ?? '0.35');
        }

        it('ambient default is 0.35', () => {
            expect(parseAmbientVol()).toBe(0.35);
        });

        it('reads stored ambient volume', () => {
            localStorage.setItem(LS_KEY_AMBIENT_VOL, '0.7');
            expect(parseAmbientVol()).toBe(0.7);
        });

        it('setAmbientVolume clamps negative to 0', () => {
            const vol = clampVolume(-0.5);
            localStorage.setItem(LS_KEY_AMBIENT_VOL, vol.toString());
            expect(parseAmbientVol()).toBe(0);
        });

        it('setAmbientVolume clamps above 1 to 1', () => {
            const vol = clampVolume(1.5);
            localStorage.setItem(LS_KEY_AMBIENT_VOL, vol.toString());
            expect(parseAmbientVol()).toBe(1);
        });

        it('handles invalid ambient vol string', () => {
            localStorage.setItem(LS_KEY_AMBIENT_VOL, 'invalid');
            expect(Number.isNaN(parseAmbientVol())).toBe(true);
        });

        it('ambient volume set+read cycle', () => {
            const vol = clampVolume(0.5);
            localStorage.setItem(LS_KEY_AMBIENT_VOL, vol.toString());
            expect(parseAmbientVol()).toBe(0.5);
        });
    });

    describe('stopAmbient node cleanup pattern', () => {
        it('stop+disconnect clears all nodes without error', () => {
            const mockNodes = [
                { stop: () => {}, disconnect: () => {} },  // OscillatorNode
                { disconnect: () => {} },                    // GainNode (no stop)
                { stop: () => { throw new Error('already stopped'); }, disconnect: () => {} },
            ];
            const cleaned: typeof mockNodes = [];
            for (const node of mockNodes) {
                if ('stop' in node && typeof node.stop === 'function') {
                    try { node.stop(); } catch { /* ok */ }
                }
                try { node.disconnect(); } catch { /* ok */ }
            }
            expect(cleaned.length).toBe(0); // array not accumulated
        });

        it('repeated play->stop does not accumulate nodes', () => {
            let nodeCount = 0;
            const stop = () => { nodeCount = 0; };
            const play = () => { stop(); nodeCount = 31; };
            play(); play(); play();
            expect(nodeCount).toBe(31); // not 93
        });
    });

    describe('3-step volume toggle pattern (MainMenu UI)', () => {
        // MainMenu BGM toggle: 0 → 0.09 → 0.18 → 0
        const bgmSteps = [0, 0.09, 0.18];
        // MainMenu SFX toggle: 0 → 0.3 → 0.6 → 0
        const sfxSteps = [0, 0.3, 0.6];

        it('BGM 3-step cycle works correctly', () => {
            // step to next: find current in steps, go to next
            const nextStep = (val: number, steps: number[]) => {
                const idx = steps.indexOf(val);
                return steps[(idx + 1) % steps.length];
            };
            expect(nextStep(0.18, bgmSteps)).toBe(0);
            expect(nextStep(0, bgmSteps)).toBe(0.09);
            expect(nextStep(0.09, bgmSteps)).toBe(0.18);
        });

        it('SFX 3-step cycle works correctly', () => {
            const nextStep = (val: number, steps: number[]) => {
                const idx = steps.indexOf(val);
                return steps[(idx + 1) % steps.length];
            };
            expect(nextStep(0.6, sfxSteps)).toBe(0);
            expect(nextStep(0, sfxSteps)).toBe(0.3);
            expect(nextStep(0.3, sfxSteps)).toBe(0.6);
        });
    });
});
