import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from '../utils/PerspectiveCamera';

/**
 * RoadRenderer LUT 보간 정확도 테스트.
 *
 * RoadRenderer.sampleLaneDash()는 LUT(Look-Up Table)에 사전 계산된
 * projectZ/getRoadEdgeX 결과를 선형 보간해서 반환한다.
 *
 * 여기서는 LUT 구축에 사용되는 PerspectiveCamera 정적 함수들을 직접 검증하고,
 * "N개 샘플 + 선형 보간" 방식의 오차가 허용 범위(0.1px) 이내인지 확인한다.
 * (RoadRenderer 자체는 Phaser Scene 의존이 있어 직접 인스턴스화가 불가)
 */

const LANE_DASH_LUT_SIZE = 128; // RoadRenderer와 동일

/** LUT 구축 로직 (RoadRenderer.buildLaneDashLUT와 동일) */
function buildLUT() {
    const lut: { screenY: number; edgeRight: number }[] = new Array(LANE_DASH_LUT_SIZE + 1);
    for (let i = 0; i <= LANE_DASH_LUT_SIZE; i++) {
        const z = i / LANE_DASH_LUT_SIZE;
        const { screenY } = PerspectiveCamera.projectZ(z);
        const { right } = PerspectiveCamera.getRoadEdgeX(z);
        lut[i] = { screenY, edgeRight: right };
    }
    return lut;
}

/** LUT 선형 보간 (RoadRenderer.sampleLaneDash와 동일) */
function sampleLUT(lut: { screenY: number; edgeRight: number }[], z: number) {
    const raw = Math.max(0, Math.min(1, z)) * LANE_DASH_LUT_SIZE;
    const lo = Math.floor(raw);
    const hi = Math.min(lo + 1, LANE_DASH_LUT_SIZE);
    const frac = raw - lo;
    const a = lut[lo];
    const b = lut[hi];
    return {
        screenY: a.screenY + (b.screenY - a.screenY) * frac,
        edgeRight: a.edgeRight + (b.edgeRight - a.edgeRight) * frac,
    };
}

describe('RoadRenderer LUT — 구축 정확도', () => {
    const lut = buildLUT();

    it('LUT 크기는 LANE_DASH_LUT_SIZE + 1', () => {
        expect(lut.length).toBe(LANE_DASH_LUT_SIZE + 1);
    });

    it('z=0 샘플 (lut[0]) — projectZ/getRoadEdgeX와 정확히 일치', () => {
        const { screenY } = PerspectiveCamera.projectZ(0);
        const { right } = PerspectiveCamera.getRoadEdgeX(0);
        expect(lut[0].screenY).toBeCloseTo(screenY, 5);
        expect(lut[0].edgeRight).toBeCloseTo(right, 5);
    });

    it('z=1 샘플 (lut[128]) — projectZ/getRoadEdgeX와 정확히 일치', () => {
        const { screenY } = PerspectiveCamera.projectZ(1);
        const { right } = PerspectiveCamera.getRoadEdgeX(1);
        expect(lut[LANE_DASH_LUT_SIZE].screenY).toBeCloseTo(screenY, 5);
        expect(lut[LANE_DASH_LUT_SIZE].edgeRight).toBeCloseTo(right, 5);
    });

    it('z=0.5 샘플 (lut[64]) — projectZ/getRoadEdgeX와 정확히 일치', () => {
        const { screenY } = PerspectiveCamera.projectZ(0.5);
        const { right } = PerspectiveCamera.getRoadEdgeX(0.5);
        expect(lut[64].screenY).toBeCloseTo(screenY, 5);
        expect(lut[64].edgeRight).toBeCloseTo(right, 5);
    });

    it('screenY는 z가 증가할수록 감소 (소실점으로 수렴)', () => {
        // z가 클수록 먼 곳 → 화면 위쪽(screenY 감소)
        expect(lut[0].screenY).toBeGreaterThan(lut[64].screenY);
        expect(lut[64].screenY).toBeGreaterThan(lut[128].screenY);
    });

    it('edgeRight는 z가 증가할수록 감소 (도로가 좁아짐)', () => {
        expect(lut[0].edgeRight).toBeGreaterThan(lut[64].edgeRight);
        expect(lut[64].edgeRight).toBeGreaterThan(lut[128].edgeRight);
    });
});

describe('RoadRenderer LUT — 보간 정확도 (오차 < 0.1px)', () => {
    const lut = buildLUT();

    it('격자 경계 z값은 보간 결과가 직접 계산과 정확히 일치', () => {
        for (let i = 0; i <= LANE_DASH_LUT_SIZE; i += 16) {
            const z = i / LANE_DASH_LUT_SIZE;
            const sampled = sampleLUT(lut, z);
            const direct = PerspectiveCamera.projectZ(z);
            expect(sampled.screenY).toBeCloseTo(direct.screenY, 4);
        }
    });

    it('격자 중간 z값 보간 오차 < 0.1px (screenY)', () => {
        // 각 셀의 중간점에서 오차를 검사
        for (let i = 0; i < LANE_DASH_LUT_SIZE; i += 16) {
            const z = (i + 0.5) / LANE_DASH_LUT_SIZE;
            const sampled = sampleLUT(lut, z);
            const direct = PerspectiveCamera.projectZ(z);
            expect(Math.abs(sampled.screenY - direct.screenY)).toBeLessThan(0.1);
        }
    });

    it('격자 중간 z값 보간 오차 < 0.1px (edgeRight)', () => {
        for (let i = 0; i < LANE_DASH_LUT_SIZE; i += 16) {
            const z = (i + 0.5) / LANE_DASH_LUT_SIZE;
            const sampled = sampleLUT(lut, z);
            const { right } = PerspectiveCamera.getRoadEdgeX(z);
            expect(Math.abs(sampled.edgeRight - right)).toBeLessThan(0.1);
        }
    });

    it('z < 0 클램프 → lut[0] 반환', () => {
        const sampled = sampleLUT(lut, -0.5);
        expect(sampled.screenY).toBeCloseTo(lut[0].screenY, 5);
        expect(sampled.edgeRight).toBeCloseTo(lut[0].edgeRight, 5);
    });

    it('z > 1 클램프 → lut[128] 반환', () => {
        const sampled = sampleLUT(lut, 1.5);
        expect(sampled.screenY).toBeCloseTo(lut[LANE_DASH_LUT_SIZE].screenY, 5);
        expect(sampled.edgeRight).toBeCloseTo(lut[LANE_DASH_LUT_SIZE].edgeRight, 5);
    });
});
