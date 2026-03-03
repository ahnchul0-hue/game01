import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from '../systems/PerspectiveCamera';
import {
    VANISH_Y,
    ROAD_HEIGHT,
    CENTER_X,
    LANE_SPREAD,
    ROAD_WIDTH_NEAR,
    ROAD_WIDTH_FAR,
} from '../utils/Constants';

describe('PerspectiveCamera', () => {
    // ── projectZ ──────────────────────────────────

    describe('projectZ', () => {
        it('z=1.0 (소실점) → screenY=VANISH_Y, scale=0.15(최솟값)', () => {
            const result = PerspectiveCamera.projectZ(1.0);
            expect(result.screenY).toBe(VANISH_Y);
            expect(result.scale).toBe(0.15); // max(0.15, pow(0, 0.55)) = 0.15
            expect(result.t).toBe(0);
        });

        it('z=0.0 (카메라) → screenY=CAMERA_Y, scale=1.0', () => {
            const result = PerspectiveCamera.projectZ(0.0);
            expect(result.screenY).toBe(VANISH_Y + ROAD_HEIGHT);
            expect(result.scale).toBe(1.0); // pow(1, 0.55) = 1.0
            expect(result.t).toBe(1);
        });

        it('z=0.5 (중간) → 비선형 스케일', () => {
            const result = PerspectiveCamera.projectZ(0.5);
            expect(result.screenY).toBe(VANISH_Y + ROAD_HEIGHT * 0.5);
            // pow(0.5, 0.55) ≈ 0.6825
            expect(result.scale).toBeCloseTo(Math.pow(0.5, 0.55), 3);
            expect(result.t).toBe(0.5);
        });

        it('z > 1.0 → scale은 0.15 최솟값 보장', () => {
            const result = PerspectiveCamera.projectZ(1.5);
            expect(result.scale).toBe(0.15);
            expect(result.t).toBe(-0.5);
        });

        it('z < 0.0 → scale은 pow(t, 0.55)로 증가', () => {
            const result = PerspectiveCamera.projectZ(-0.1);
            expect(result.t).toBeCloseTo(1.1);
            expect(result.scale).toBeCloseTo(Math.pow(1.1, 0.55), 3);
        });

        it('screenY는 z가 감소할수록 증가 (멀리→가까이)', () => {
            const far = PerspectiveCamera.projectZ(0.9);
            const near = PerspectiveCamera.projectZ(0.1);
            expect(near.screenY).toBeGreaterThan(far.screenY);
        });
    });

    // ── getLaneScreenX ────────────────────────────

    describe('getLaneScreenX', () => {
        it('중앙 레인(offset=0) → CENTER_X (모든 z)', () => {
            expect(PerspectiveCamera.getLaneScreenX(0.0, 0)).toBe(CENTER_X);
            expect(PerspectiveCamera.getLaneScreenX(0.5, 0)).toBe(CENTER_X);
            expect(PerspectiveCamera.getLaneScreenX(1.0, 0)).toBe(CENTER_X);
        });

        it('좌우 레인은 CENTER_X 기준 대칭', () => {
            const z = 0.3;
            const left = PerspectiveCamera.getLaneScreenX(z, -1);
            const right = PerspectiveCamera.getLaneScreenX(z, 1);
            expect(left + right).toBeCloseTo(CENTER_X * 2);
        });

        it('z=0 (카메라)에서 레인 간격 = LANE_SPREAD', () => {
            const center = PerspectiveCamera.getLaneScreenX(0, 0);
            const right = PerspectiveCamera.getLaneScreenX(0, 1);
            expect(right - center).toBe(LANE_SPREAD);
        });

        it('z=1 (소실점)에서 레인이 수렴 (간격=0)', () => {
            const center = PerspectiveCamera.getLaneScreenX(1.0, 0);
            const right = PerspectiveCamera.getLaneScreenX(1.0, 1);
            expect(right - center).toBe(0);
        });

        it('레인 간격은 z가 감소할수록 넓어짐', () => {
            const spreadFar = Math.abs(
                PerspectiveCamera.getLaneScreenX(0.8, 1) - PerspectiveCamera.getLaneScreenX(0.8, 0),
            );
            const spreadNear = Math.abs(
                PerspectiveCamera.getLaneScreenX(0.2, 1) - PerspectiveCamera.getLaneScreenX(0.2, 0),
            );
            expect(spreadNear).toBeGreaterThan(spreadFar);
        });
    });

    // ── getRoadEdgeX ──────────────────────────────

    describe('getRoadEdgeX', () => {
        it('도로 가장자리는 항상 CENTER_X 기준 대칭', () => {
            for (const z of [0, 0.25, 0.5, 0.75, 1.0]) {
                const { left, right } = PerspectiveCamera.getRoadEdgeX(z);
                expect((left + right) / 2).toBeCloseTo(CENTER_X);
            }
        });

        it('z=0 (카메라)에서 도로 폭 = ROAD_WIDTH_NEAR', () => {
            const { left, right } = PerspectiveCamera.getRoadEdgeX(0);
            expect(right - left).toBeCloseTo(ROAD_WIDTH_NEAR);
        });

        it('z=1 (소실점)에서 도로 폭 = ROAD_WIDTH_FAR', () => {
            const { left, right } = PerspectiveCamera.getRoadEdgeX(1.0);
            expect(right - left).toBeCloseTo(ROAD_WIDTH_FAR);
        });

        it('left < CENTER_X < right 항상 성립', () => {
            for (const z of [0, 0.1, 0.5, 0.9, 1.0]) {
                const { left, right } = PerspectiveCamera.getRoadEdgeX(z);
                expect(left).toBeLessThan(CENTER_X);
                expect(right).toBeGreaterThan(CENTER_X);
            }
        });

        it('도로 폭은 z가 감소할수록 넓어짐', () => {
            const farWidth = PerspectiveCamera.getRoadWidth(0.9);
            const nearWidth = PerspectiveCamera.getRoadWidth(0.1);
            expect(nearWidth).toBeGreaterThan(farWidth);
        });
    });

    // ── getRoadWidth ──────────────────────────────

    describe('getRoadWidth', () => {
        it('z=0 → ROAD_WIDTH_NEAR', () => {
            expect(PerspectiveCamera.getRoadWidth(0)).toBeCloseTo(ROAD_WIDTH_NEAR);
        });

        it('z=1 → ROAD_WIDTH_FAR', () => {
            expect(PerspectiveCamera.getRoadWidth(1.0)).toBeCloseTo(ROAD_WIDTH_FAR);
        });

        it('z=0.5 → 중간값', () => {
            const expected = (ROAD_WIDTH_NEAR + ROAD_WIDTH_FAR) / 2;
            expect(PerspectiveCamera.getRoadWidth(0.5)).toBeCloseTo(expected);
        });

        it('getRoadWidth와 getRoadEdgeX는 일관성 유지', () => {
            for (const z of [0, 0.3, 0.7, 1.0]) {
                const width = PerspectiveCamera.getRoadWidth(z);
                const { left, right } = PerspectiveCamera.getRoadEdgeX(z);
                expect(right - left).toBeCloseTo(width);
            }
        });
    });
});
