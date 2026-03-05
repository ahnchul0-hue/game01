import Phaser from 'phaser';
import { PerspectiveCamera } from './PerspectiveCamera';
import {
    GAME_WIDTH,
    VANISH_Y,
    CAMERA_Y,
    CENTER_X,
    ROAD_SEGMENTS,
    ROAD_STRIPE_COUNT,
    DASH_LENGTH,
    STAGE_COLORS,
} from '../utils/Constants';
import type { StageType } from '../utils/Constants';

/** 사전 계산된 세그먼트 투영 좌표 */
interface SegmentCache {
    z0: number;
    z1: number;
    y0: number;
    y1: number;
    leftX0: number;
    rightX0: number;
    leftX1: number;
    rightX1: number;
}

/**
 * 레인 대시 LUT (Look-Up Table) 항목.
 * z 그리드의 각 샘플 지점에 대한 사전 계산 투영값.
 */
interface LaneDashLUT {
    screenY: number;
    edgeRight: number; // CENTER_X 기준 오른쪽 가장자리 X (왼쪽은 -edgeRight로 대칭)
}

/** 레인 대시 LUT 해상도 (z=[0,1]을 몇 단계로 분할할지) */
const LANE_DASH_LUT_SIZE = 128;

/**
 * 의사-3D 원근 도로 렌더러 (최적화 버전).
 *
 * 최적화 전략:
 * - 세그먼트 투영 좌표를 생성자에서 1회만 계산 (segmentCache)
 * - 정적 도로(사다리꼴+가장자리)와 동적 대시를 별도 Graphics로 분리
 * - 하늘/도로는 dirty flag로 색상 전환 시에만 재그리기
 * - 대시 마킹만 매 프레임 갱신
 */
export class RoadRenderer {
    private staticRoadGfx: Phaser.GameObjects.Graphics;
    private stripeGfx: Phaser.GameObjects.Graphics;
    private skyGraphics: Phaser.GameObjects.Graphics;

    // 세그먼트 투영 좌표 캐시 (생성자에서 1회 계산)
    private segmentCache: SegmentCache[] = [];

    // 레인 대시 투영 LUT: z=[0,1]을 LANE_DASH_LUT_SIZE 단계로 분할하여 사전 계산
    // projectZ / getRoadEdgeX는 순수 함수이므로 화면 크기가 변하지 않는 한 유효
    private laneDashLUT: LaneDashLUT[] = [];
    // LUT 유효 여부 (화면 크기 변경 시 false로 초기화)
    private laneDashLUTDirty = true;

    // 대시 마킹 이동용 오프셋 (0~1 루프)
    private dashOffset = 0;

    // 현재 스테이지 색상
    private skyColor: number;
    private groundColor: number;
    private roadColor: number;
    private laneColor: number;

    // 색상 전환
    private targetSkyColor: number;
    private targetGroundColor: number;
    private targetRoadColor: number;
    private startSkyColor: number;
    private startGroundColor: number;
    private startRoadColor: number;
    private transitionProgress = 1; // 1 = 전환 완료
    private transitionDuration = 0;
    private transitionElapsed = 0;

    // dirty flags: 정적 레이어 재그리기 필요 여부
    private skyDirty = true;
    private roadDirty = true;

    constructor(scene: Phaser.Scene, initialStage: StageType = 'forest') {
        const colors = STAGE_COLORS[initialStage];
        this.skyColor = colors.sky;
        this.groundColor = colors.ground;
        this.roadColor = this.darken(colors.ground, 20);
        this.laneColor = 0xFFFFFF;

        this.targetSkyColor = this.skyColor;
        this.targetGroundColor = this.groundColor;
        this.targetRoadColor = this.roadColor;
        this.startSkyColor = this.skyColor;
        this.startGroundColor = this.groundColor;
        this.startRoadColor = this.roadColor;

        // 하늘(뒤) + 정적 도로(중간) + 동적 대시(위)
        this.skyGraphics = scene.add.graphics().setDepth(0);
        this.staticRoadGfx = scene.add.graphics().setDepth(1);
        this.stripeGfx = scene.add.graphics().setDepth(1);

        // 세그먼트 투영 좌표 사전 계산 (z값은 고정이므로 1회만)
        this.buildSegmentCache();

        // 레인 대시 LUT 사전 계산 (화면 크기가 변하지 않는 한 1회만)
        this.buildLaneDashLUT();
    }

    /** 세그먼트별 투영 좌표를 1회 계산하여 캐시 */
    private buildSegmentCache(): void {
        this.segmentCache = [];
        for (let i = 0; i < ROAD_SEGMENTS; i++) {
            const z0 = i / ROAD_SEGMENTS;
            const z1 = (i + 1) / ROAD_SEGMENTS;
            const edge0 = PerspectiveCamera.getRoadEdgeX(z0);
            const edge1 = PerspectiveCamera.getRoadEdgeX(z1);
            const y0 = PerspectiveCamera.projectZ(z0).screenY;
            const y1 = PerspectiveCamera.projectZ(z1).screenY;
            this.segmentCache.push({
                z0, z1, y0, y1,
                leftX0: edge0.left, rightX0: edge0.right,
                leftX1: edge1.left, rightX1: edge1.right,
            });
        }
    }

    /**
     * 레인 대시 투영 LUT를 구축한다.
     *
     * z=[0,1] 구간을 LANE_DASH_LUT_SIZE 개 샘플로 분할하여
     * projectZ()와 getRoadEdgeX()를 사전 계산한다.
     * 화면 크기(VANISH_Y, ROAD_HEIGHT 등 Constants)가 변하지 않는 한
     * 생성자에서 1회만 호출하면 된다.
     */
    private buildLaneDashLUT(): void {
        this.laneDashLUT = new Array(LANE_DASH_LUT_SIZE + 1);
        for (let i = 0; i <= LANE_DASH_LUT_SIZE; i++) {
            const z = i / LANE_DASH_LUT_SIZE;
            const { screenY } = PerspectiveCamera.projectZ(z);
            const { right } = PerspectiveCamera.getRoadEdgeX(z);
            this.laneDashLUT[i] = { screenY, edgeRight: right };
        }
        this.laneDashLUTDirty = false;
    }

    /**
     * LUT에서 z값에 대한 투영 결과를 선형 보간하여 반환.
     *
     * z를 [0, LANE_DASH_LUT_SIZE] 인덱스로 매핑한 뒤
     * 인접 두 샘플을 보간하므로 projectZ() 직접 호출 대비
     * 오차는 무시할 수준(<0.1px)이고 연산 비용은 크게 절감된다.
     */
    private sampleLaneDash(z: number): LaneDashLUT {
        // LUT가 무효화된 경우 재빌드 (화면 크기 변경 등)
        if (this.laneDashLUTDirty) {
            this.buildLaneDashLUT();
        }

        const raw = Math.max(0, Math.min(1, z)) * LANE_DASH_LUT_SIZE;
        const lo = Math.floor(raw);
        const hi = Math.min(lo + 1, LANE_DASH_LUT_SIZE);
        const frac = raw - lo;

        const a = this.laneDashLUT[lo];
        const b = this.laneDashLUT[hi];
        return {
            screenY: a.screenY + (b.screenY - a.screenY) * frac,
            edgeRight: a.edgeRight + (b.edgeRight - a.edgeRight) * frac,
        };
    }

    /**
     * 매 프레임 호출.
     */
    update(gameSpeed: number, dt: number): void {
        // 대시 오프셋 이동
        this.dashOffset += gameSpeed * dt * 0.0004;
        if (this.dashOffset > 1) this.dashOffset -= 1;

        // 색상 전환 업데이트
        if (this.transitionProgress < 1) {
            this.transitionElapsed += dt;
            this.transitionProgress = Math.min(this.transitionElapsed / this.transitionDuration, 1);

            this.skyColor = this.lerpColor(this.startSkyColor, this.targetSkyColor, this.transitionProgress);
            this.groundColor = this.lerpColor(this.startGroundColor, this.targetGroundColor, this.transitionProgress);
            this.roadColor = this.lerpColor(this.startRoadColor, this.targetRoadColor, this.transitionProgress);

            if (this.transitionProgress >= 1) {
                this.skyColor = this.targetSkyColor;
                this.groundColor = this.targetGroundColor;
                this.roadColor = this.targetRoadColor;
            }

            // 색상 전환 중에만 정적 레이어 갱신
            this.skyDirty = true;
            this.roadDirty = true;
        }

        // 정적 레이어: dirty일 때만 재그리기
        if (this.skyDirty) {
            this.drawSky();
            this.skyDirty = false;
        }
        if (this.roadDirty) {
            this.drawStaticRoad();
            this.roadDirty = false;
        }

        // 동적 레이어: 매 프레임 대시 마킹만 갱신
        this.drawStripes();
    }

    /** 스테이지 전환 — 색상 크로스페이드 시작 */
    transitionToStage(stage: StageType, duration: number): void {
        const colors = STAGE_COLORS[stage];
        this.startSkyColor = this.skyColor;
        this.startGroundColor = this.groundColor;
        this.startRoadColor = this.roadColor;
        this.targetSkyColor = colors.sky;
        this.targetGroundColor = colors.ground;
        this.targetRoadColor = this.darken(colors.ground, 20);
        this.transitionProgress = 0;
        this.transitionDuration = duration;
        this.transitionElapsed = 0;
    }

    /** 즉시 스테이지 색상 설정 (부활 등) */
    setStage(stage: StageType): void {
        const colors = STAGE_COLORS[stage];
        this.skyColor = colors.sky;
        this.groundColor = colors.ground;
        this.roadColor = this.darken(colors.ground, 20);
        this.targetSkyColor = this.skyColor;
        this.targetGroundColor = this.groundColor;
        this.targetRoadColor = this.roadColor;
        this.startSkyColor = this.skyColor;
        this.startGroundColor = this.groundColor;
        this.startRoadColor = this.roadColor;
        this.transitionProgress = 1;
        this.skyDirty = true;
        this.roadDirty = true;
    }

    /**
     * 화면 크기가 변경되었을 때 호출.
     *
     * PerspectiveCamera의 투영 결과(screenY, edgeX)는 Constants의
     * VANISH_Y / ROAD_HEIGHT 등에 의존하므로, 런타임에 화면 크기가
     * 바뀌는 경우 LUT와 segmentCache를 재빌드해야 한다.
     * (현재 게임은 고정 해상도이지만 향후 리사이즈 대응을 위해 제공)
     */
    onResize(): void {
        this.buildSegmentCache();
        this.buildLaneDashLUT();
        this.skyDirty = true;
        this.roadDirty = true;
    }

    destroy(): void {
        this.skyGraphics.destroy();
        this.staticRoadGfx.destroy();
        this.stripeGfx.destroy();
    }

    // ===== Private: 정적 레이어 =====

    private drawSky(): void {
        this.skyGraphics.clear();

        const steps = 20;
        const topColor = this.lighten(this.skyColor, 15);
        const stepH = VANISH_Y / steps;

        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const c = this.lerpColor(topColor, this.skyColor, t);
            this.skyGraphics.fillStyle(c, 1);
            this.skyGraphics.fillRect(0, i * stepH, GAME_WIDTH, stepH + 1);
        }

        // 소실점 아래는 지면색
        this.skyGraphics.fillStyle(this.groundColor, 1);
        this.skyGraphics.fillRect(0, VANISH_Y, GAME_WIDTH, CAMERA_Y - VANISH_Y + 200);
    }

    private drawStaticRoad(): void {
        this.staticRoadGfx.clear();

        // 도로 본체: 캐시된 세그먼트 좌표 사용
        for (const seg of this.segmentCache) {
            const brightness = (1 - seg.z0) * 5;
            const segColor = this.lighten(this.roadColor, brightness);

            this.staticRoadGfx.fillStyle(segColor, 1);
            this.staticRoadGfx.beginPath();
            this.staticRoadGfx.moveTo(seg.leftX0, seg.y0);
            this.staticRoadGfx.lineTo(seg.leftX1, seg.y1);
            this.staticRoadGfx.lineTo(seg.rightX1, seg.y1);
            this.staticRoadGfx.lineTo(seg.rightX0, seg.y0);
            this.staticRoadGfx.closePath();
            this.staticRoadGfx.fillPath();
        }

        // 도로 가장자리 (흰색 실선) — 캐시 사용
        this.staticRoadGfx.lineStyle(2, 0xFFFFFF, 0.6);
        this.drawRoadEdgeLine(-1);
        this.drawRoadEdgeLine(1);
    }

    // ===== Private: 동적 레이어 (매 프레임) =====

    private drawStripes(): void {
        this.stripeGfx.clear();

        // 레인 구분선 (점선)
        this.drawLaneDashes(-0.5);
        this.drawLaneDashes(0.5);

        // 이동 대시 마킹 (중앙선)
        this.drawMovingDashes();
    }

    /** 도로 가장자리 연속선 — 캐시 사용 */
    private drawRoadEdgeLine(side: -1 | 1): void {
        this.staticRoadGfx.beginPath();
        for (let i = 0; i <= ROAD_SEGMENTS; i++) {
            // 캐시에서 가장자리 좌표 조회 (마지막 세그먼트의 far edge 사용)
            let x: number, y: number;
            if (i < ROAD_SEGMENTS) {
                const seg = this.segmentCache[i];
                x = side === -1 ? seg.leftX0 : seg.rightX0;
                y = seg.y0;
            } else {
                const seg = this.segmentCache[i - 1];
                x = side === -1 ? seg.leftX1 : seg.rightX1;
                y = seg.y1;
            }
            if (i === 0) this.staticRoadGfx.moveTo(x, y);
            else this.staticRoadGfx.lineTo(x, y);
        }
        this.staticRoadGfx.strokePath();
    }

    /** 레인 사이 점선 — LUT로 projectZ/getRoadEdgeX 캐시 활용 */
    private drawLaneDashes(lanePos: number): void {
        this.stripeGfx.lineStyle(1, this.laneColor, 0.25);

        for (let i = 0; i < ROAD_STRIPE_COUNT; i++) {
            const baseZ = (i / ROAD_STRIPE_COUNT + this.dashOffset) % 1;
            const z0 = baseZ;
            const z1 = Math.min(baseZ + DASH_LENGTH, 1);

            // projectZ + getRoadEdgeX를 LUT 조회로 대체 (매프레임 재계산 방지)
            const s0 = this.sampleLaneDash(z0);
            const s1 = this.sampleLaneDash(z1);

            const x0 = CENTER_X + (s0.edgeRight - CENTER_X) * lanePos * 2 / 3 * 2;
            const x1 = CENTER_X + (s1.edgeRight - CENTER_X) * lanePos * 2 / 3 * 2;

            this.stripeGfx.beginPath();
            this.stripeGfx.moveTo(x0, s0.screenY);
            this.stripeGfx.lineTo(x1, s1.screenY);
            this.stripeGfx.strokePath();
        }
    }

    /** 속도에 맞춰 이동하는 중앙 대시 마킹 — LUT로 projectZ 캐시 활용 */
    private drawMovingDashes(): void {
        this.stripeGfx.lineStyle(2, 0xFFFF00, 0.4);

        for (let i = 0; i < ROAD_STRIPE_COUNT; i++) {
            const baseZ = (i / ROAD_STRIPE_COUNT + this.dashOffset) % 1;
            const z0 = baseZ;
            const z1 = Math.min(baseZ + DASH_LENGTH * 0.5, 1);

            // screenY만 LUT 조회로 대체 (edgeRight는 중앙선이므로 불필요)
            const y0 = this.sampleLaneDash(z0).screenY;
            const y1 = this.sampleLaneDash(z1).screenY;

            this.stripeGfx.beginPath();
            this.stripeGfx.moveTo(CENTER_X, y0);
            this.stripeGfx.lineTo(CENTER_X, y1);
            this.stripeGfx.strokePath();
        }
    }

    // ===== Color Utils =====

    private darken(color: number, amount: number): number {
        const r = Math.max(0, ((color >> 16) & 0xFF) - amount);
        const g = Math.max(0, ((color >> 8) & 0xFF) - amount);
        const b = Math.max(0, (color & 0xFF) - amount);
        return (r << 16) | (g << 8) | b;
    }

    private lighten(color: number, amount: number): number {
        const r = Math.min(255, ((color >> 16) & 0xFF) + amount);
        const g = Math.min(255, ((color >> 8) & 0xFF) + amount);
        const b = Math.min(255, (color & 0xFF) + amount);
        return (r << 16) | (g << 8) | b;
    }

    private lerpColor(from: number, to: number, t: number): number {
        if (t >= 1) return to;
        if (t <= 0) return from;
        const r1 = (from >> 16) & 0xFF, g1 = (from >> 8) & 0xFF, b1 = from & 0xFF;
        const r2 = (to >> 16) & 0xFF, g2 = (to >> 8) & 0xFF, b2 = to & 0xFF;
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return (r << 16) | (g << 8) | b;
    }
}
