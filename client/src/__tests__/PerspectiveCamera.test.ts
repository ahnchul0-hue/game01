import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from '../systems/PerspectiveCamera';
import {
    VANISH_Y,
    CAMERA_Y,
    CENTER_X,
    ROAD_WIDTH_NEAR,
    ROAD_WIDTH_FAR,
    LANE_SPREAD,
} from '../utils/Constants';

describe('PerspectiveCamera', () => {
    // ====== projectZ ======
    describe('projectZ', () => {
        it('z=1 → 소실점 (화면 상단)', () => {
            const { screenY, scale, t } = PerspectiveCamera.projectZ(1);
            expect(screenY).toBe(VANISH_Y);
            expect(t).toBe(0);
            expect(scale).toBe(0.05); // min clamp
        });

        it('z=0 → 카메라 (화면 하단)', () => {
            const { screenY, scale, t } = PerspectiveCamera.projectZ(0);
            expect(screenY).toBe(CAMERA_Y);
            expect(t).toBe(1);
            expect(scale).toBe(1);
        });

        it('z=0.5 → 중간 지점', () => {
            const { screenY, scale, t } = PerspectiveCamera.projectZ(0.5);
            expect(screenY).toBe(VANISH_Y + 750 * 0.5);
            expect(t).toBe(0.5);
            expect(scale).toBe(0.5);
        });

        it('z가 감소하면 screenY 증가 (카메라 방향)', () => {
            const far = PerspectiveCamera.projectZ(0.8);
            const near = PerspectiveCamera.projectZ(0.2);
            expect(near.screenY).toBeGreaterThan(far.screenY);
            expect(near.scale).toBeGreaterThan(far.scale);
        });

        it('scale은 최소 0.05로 클램프', () => {
            const { scale } = PerspectiveCamera.projectZ(1.1); // z > 1
            expect(scale).toBe(0.05);
        });

        it('z < 0에서도 정상 동작 (디스폰 영역)', () => {
            const { screenY, t } = PerspectiveCamera.projectZ(-0.05);
            expect(t).toBe(1.05);
            expect(screenY).toBeGreaterThan(CAMERA_Y);
        });
    });

    // ====== getLaneScreenX ======
    describe('getLaneScreenX', () => {
        it('중앙 레인(offset=0)은 항상 CENTER_X', () => {
            expect(PerspectiveCamera.getLaneScreenX(0.5, 0)).toBe(CENTER_X);
            expect(PerspectiveCamera.getLaneScreenX(0.9, 0)).toBe(CENTER_X);
            expect(PerspectiveCamera.getLaneScreenX(0.1, 0)).toBe(CENTER_X);
        });

        it('z=1에서 모든 레인이 CENTER_X로 수렴', () => {
            expect(PerspectiveCamera.getLaneScreenX(1, -1)).toBe(CENTER_X);
            expect(PerspectiveCamera.getLaneScreenX(1, 0)).toBe(CENTER_X);
            expect(PerspectiveCamera.getLaneScreenX(1, 1)).toBe(CENTER_X);
        });

        it('z=0에서 레인이 최대로 벌어짐', () => {
            const left = PerspectiveCamera.getLaneScreenX(0, -1);
            const right = PerspectiveCamera.getLaneScreenX(0, 1);
            expect(left).toBe(CENTER_X - LANE_SPREAD);
            expect(right).toBe(CENTER_X + LANE_SPREAD);
        });

        it('좌/우 레인이 중앙 대칭', () => {
            const z = 0.3;
            const left = PerspectiveCamera.getLaneScreenX(z, -1);
            const right = PerspectiveCamera.getLaneScreenX(z, 1);
            expect(CENTER_X - left).toBeCloseTo(right - CENTER_X, 5);
        });

        it('가까울수록(z 작을수록) 레인 간격 넓어짐', () => {
            const nearSpread = PerspectiveCamera.getLaneScreenX(0.2, 1) - CENTER_X;
            const farSpread = PerspectiveCamera.getLaneScreenX(0.8, 1) - CENTER_X;
            expect(nearSpread).toBeGreaterThan(farSpread);
        });
    });

    // ====== getRoadEdgeX ======
    describe('getRoadEdgeX', () => {
        it('z=0에서 도로 폭 = ROAD_WIDTH_NEAR', () => {
            const { left, right } = PerspectiveCamera.getRoadEdgeX(0);
            expect(right - left).toBeCloseTo(ROAD_WIDTH_NEAR, 1);
        });

        it('z=1에서 도로 폭 = ROAD_WIDTH_FAR', () => {
            const { left, right } = PerspectiveCamera.getRoadEdgeX(1);
            expect(right - left).toBeCloseTo(ROAD_WIDTH_FAR, 1);
        });

        it('좌우 대칭 (center가 CENTER_X)', () => {
            const z = 0.4;
            const { left, right } = PerspectiveCamera.getRoadEdgeX(z);
            expect((left + right) / 2).toBeCloseTo(CENTER_X, 5);
        });
    });

    // ====== getRoadWidth ======
    describe('getRoadWidth', () => {
        it('z=0 → ROAD_WIDTH_NEAR', () => {
            expect(PerspectiveCamera.getRoadWidth(0)).toBeCloseTo(ROAD_WIDTH_NEAR, 1);
        });

        it('z=1 → ROAD_WIDTH_FAR', () => {
            expect(PerspectiveCamera.getRoadWidth(1)).toBeCloseTo(ROAD_WIDTH_FAR, 1);
        });

        it('z=0.5 → 중간값', () => {
            const expected = (ROAD_WIDTH_FAR + ROAD_WIDTH_NEAR) / 2;
            expect(PerspectiveCamera.getRoadWidth(0.5)).toBeCloseTo(expected, 1);
        });

        it('가까울수록 도로 폭 넓음', () => {
            expect(PerspectiveCamera.getRoadWidth(0.2)).toBeGreaterThan(
                PerspectiveCamera.getRoadWidth(0.8)
            );
        });
    });
});
