import {
    VANISH_Y,
    ROAD_HEIGHT,
    CENTER_X,
    LANE_SPREAD,
    ROAD_WIDTH_NEAR,
    ROAD_WIDTH_FAR,
} from '../utils/Constants';

/** 선형 보간 (Phaser 의존 제거용) */
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * 의사-3D 원근 투영 수학 클래스.
 * 순수 함수 — Phaser 의존 없음, 테스트 용이.
 *
 * z 좌표 체계:
 *   z=1.0 → 소실점 (멀리, 화면 상단)
 *   z=0.0 → 카메라  (가까이, 화면 하단)
 *
 * t = 1 - z  (0=멀리, 1=가까이)
 */
export class PerspectiveCamera {
    /**
     * z값을 화면 좌표+스케일로 투영.
     * @returns { screenY, scale, t }
     */
    static projectZ(z: number): { screenY: number; scale: number; t: number } {
        const t = 1 - z;
        const screenY = VANISH_Y + ROAD_HEIGHT * t;
        const scale = Math.max(0.05, t);
        return { screenY, scale, t };
    }

    /**
     * 특정 z에서 레인의 화면 X 좌표.
     * @param laneOffset -1(좌), 0(중), 1(우)
     */
    static getLaneScreenX(z: number, laneOffset: number): number {
        const t = 1 - z;
        return CENTER_X + laneOffset * t * LANE_SPREAD;
    }

    /**
     * 특정 z에서 도로 좌/우 가장자리 X 좌표.
     */
    static getRoadEdgeX(z: number): { left: number; right: number } {
        const t = 1 - z;
        const halfWidth = lerp(ROAD_WIDTH_FAR / 2, ROAD_WIDTH_NEAR / 2, t);
        return {
            left: CENTER_X - halfWidth,
            right: CENTER_X + halfWidth,
        };
    }

    /**
     * 특정 z에서 도로 전체 폭.
     */
    static getRoadWidth(z: number): number {
        const t = 1 - z;
        return lerp(ROAD_WIDTH_FAR, ROAD_WIDTH_NEAR, t);
    }
}
