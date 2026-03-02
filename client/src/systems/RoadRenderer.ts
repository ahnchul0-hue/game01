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

/**
 * 의사-3D 원근 도로 렌더러.
 * Phaser Graphics로 매 프레임 도로를 다시 그린다:
 * - 하늘 그라데이션 배경
 * - 소실점으로 수렴하는 사다리꼴 도로
 * - 수렴하는 레인 구분선
 * - 속도에 맞춰 이동하는 대시 마킹
 */
export class RoadRenderer {
    private roadGraphics: Phaser.GameObjects.Graphics;
    private skyGraphics: Phaser.GameObjects.Graphics;

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
    private transitionProgress = 1; // 1 = 전환 완료
    private transitionDuration = 0;
    private transitionElapsed = 0;

    constructor(scene: Phaser.Scene, initialStage: StageType = 'forest') {
        const colors = STAGE_COLORS[initialStage];
        this.skyColor = colors.sky;
        this.groundColor = colors.ground;
        this.roadColor = this.darken(colors.ground, 20);
        this.laneColor = 0xFFFFFF;

        this.targetSkyColor = this.skyColor;
        this.targetGroundColor = this.groundColor;
        this.targetRoadColor = this.roadColor;

        // 하늘 배경 (뒤) + 도로 (위)
        this.skyGraphics = scene.add.graphics().setDepth(0);
        this.roadGraphics = scene.add.graphics().setDepth(1);
    }

    /**
     * 매 프레임 호출. 도로를 다시 그린다.
     * @param gameSpeed 현재 게임 속도 (px/s)
     * @param dt 델타 시간 (초)
     */
    update(gameSpeed: number, dt: number): void {
        // 대시 오프셋 이동 (속도에 비례)
        this.dashOffset += gameSpeed * dt * 0.0004;
        if (this.dashOffset > 1) this.dashOffset -= 1;

        // 색상 전환 업데이트
        if (this.transitionProgress < 1) {
            this.transitionElapsed += dt;
            this.transitionProgress = Math.min(this.transitionElapsed / this.transitionDuration, 1);

            this.skyColor = this.lerpColor(this.skyColor, this.targetSkyColor, this.transitionProgress);
            this.groundColor = this.lerpColor(this.groundColor, this.targetGroundColor, this.transitionProgress);
            this.roadColor = this.lerpColor(this.roadColor, this.targetRoadColor, this.transitionProgress);

            if (this.transitionProgress >= 1) {
                this.skyColor = this.targetSkyColor;
                this.groundColor = this.targetGroundColor;
                this.roadColor = this.targetRoadColor;
            }
        }

        this.drawSky();
        this.drawRoad();
    }

    /**
     * 스테이지 전환 — 색상 크로스페이드 시작
     */
    transitionToStage(stage: StageType, duration: number): void {
        const colors = STAGE_COLORS[stage];
        this.targetSkyColor = colors.sky;
        this.targetGroundColor = colors.ground;
        this.targetRoadColor = this.darken(colors.ground, 20);
        this.transitionProgress = 0;
        this.transitionDuration = duration;
        this.transitionElapsed = 0;
    }

    /**
     * 즉시 스테이지 색상 설정 (부활 등)
     */
    setStage(stage: StageType): void {
        const colors = STAGE_COLORS[stage];
        this.skyColor = colors.sky;
        this.groundColor = colors.ground;
        this.roadColor = this.darken(colors.ground, 20);
        this.targetSkyColor = this.skyColor;
        this.targetGroundColor = this.groundColor;
        this.targetRoadColor = this.roadColor;
        this.transitionProgress = 1;
    }

    destroy(): void {
        this.skyGraphics.destroy();
        this.roadGraphics.destroy();
    }

    // ===== Private =====

    private drawSky(): void {
        this.skyGraphics.clear();

        // 하늘 그라데이션: 상단(밝은 하늘) → 소실점(하늘색) → 하단(땅색)
        const steps = 20;
        const topColor = this.lighten(this.skyColor, 15);
        const stepH = VANISH_Y / steps;

        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const c = this.lerpColor(topColor, this.skyColor, t);
            this.skyGraphics.fillStyle(c, 1);
            this.skyGraphics.fillRect(0, i * stepH, GAME_WIDTH, stepH + 1);
        }

        // 소실점 아래는 지면색 (도로가 위에 그려짐)
        this.skyGraphics.fillStyle(this.groundColor, 1);
        this.skyGraphics.fillRect(0, VANISH_Y, GAME_WIDTH, CAMERA_Y - VANISH_Y + 200);
    }

    private drawRoad(): void {
        this.roadGraphics.clear();

        // 도로 본체: 세그먼트별 사다리꼴
        for (let i = 0; i < ROAD_SEGMENTS; i++) {
            const z0 = i / ROAD_SEGMENTS;       // near z (0=camera)
            const z1 = (i + 1) / ROAD_SEGMENTS; // far z

            const edge0 = PerspectiveCamera.getRoadEdgeX(z0);
            const edge1 = PerspectiveCamera.getRoadEdgeX(z1);
            const y0 = PerspectiveCamera.projectZ(z0).screenY;
            const y1 = PerspectiveCamera.projectZ(z1).screenY;

            // 도로 색상 (가까울수록 약간 밝게)
            const brightness = (1 - z0) * 5;
            const segColor = this.lighten(this.roadColor, brightness);

            this.roadGraphics.fillStyle(segColor, 1);
            this.roadGraphics.beginPath();
            this.roadGraphics.moveTo(edge0.left, y0);
            this.roadGraphics.lineTo(edge1.left, y1);
            this.roadGraphics.lineTo(edge1.right, y1);
            this.roadGraphics.lineTo(edge0.right, y0);
            this.roadGraphics.closePath();
            this.roadGraphics.fillPath();
        }

        // 도로 가장자리 (흰색 실선)
        this.roadGraphics.lineStyle(2, 0xFFFFFF, 0.6);
        this.drawRoadEdgeLine(-1); // 좌
        this.drawRoadEdgeLine(1);  // 우

        // 레인 구분선 (점선)
        this.drawLaneDashes(-0.5);
        this.drawLaneDashes(0.5);

        // 이동 대시 마킹 (중앙선)
        this.drawMovingDashes();
    }

    /** 도로 가장자리 연속선 */
    private drawRoadEdgeLine(side: -1 | 1): void {
        this.roadGraphics.beginPath();
        for (let i = 0; i <= ROAD_SEGMENTS; i++) {
            const z = i / ROAD_SEGMENTS;
            const edge = PerspectiveCamera.getRoadEdgeX(z);
            const y = PerspectiveCamera.projectZ(z).screenY;
            const x = side === -1 ? edge.left : edge.right;
            if (i === 0) this.roadGraphics.moveTo(x, y);
            else this.roadGraphics.lineTo(x, y);
        }
        this.roadGraphics.strokePath();
    }

    /** 레인 사이 점선 (좌/우 1/3, 2/3 위치) */
    private drawLaneDashes(lanePos: number): void {
        this.roadGraphics.lineStyle(1, this.laneColor, 0.25);

        for (let i = 0; i < ROAD_STRIPE_COUNT; i++) {
            const baseZ = (i / ROAD_STRIPE_COUNT + this.dashOffset) % 1;
            const z0 = baseZ;
            const z1 = Math.min(baseZ + DASH_LENGTH, 1);

            const { screenY: y0 } = PerspectiveCamera.projectZ(z0);
            const { screenY: y1 } = PerspectiveCamera.projectZ(z1);

            // lanePos를 도로 폭 내 비율로 X 계산
            const edge0 = PerspectiveCamera.getRoadEdgeX(z0);
            const edge1 = PerspectiveCamera.getRoadEdgeX(z1);
            const x0 = CENTER_X + (edge0.right - CENTER_X) * lanePos * 2 / 3 * 2;
            const x1 = CENTER_X + (edge1.right - CENTER_X) * lanePos * 2 / 3 * 2;

            this.roadGraphics.beginPath();
            this.roadGraphics.moveTo(x0, y0);
            this.roadGraphics.lineTo(x1, y1);
            this.roadGraphics.strokePath();
        }
    }

    /** 속도에 맞춰 이동하는 중앙 대시 마킹 */
    private drawMovingDashes(): void {
        this.roadGraphics.lineStyle(2, 0xFFFF00, 0.4);

        for (let i = 0; i < ROAD_STRIPE_COUNT; i++) {
            const baseZ = (i / ROAD_STRIPE_COUNT + this.dashOffset) % 1;
            const z0 = baseZ;
            const z1 = Math.min(baseZ + DASH_LENGTH * 0.5, 1);

            const { screenY: y0 } = PerspectiveCamera.projectZ(z0);
            const { screenY: y1 } = PerspectiveCamera.projectZ(z1);

            this.roadGraphics.beginPath();
            this.roadGraphics.moveTo(CENTER_X, y0);
            this.roadGraphics.lineTo(CENTER_X, y1);
            this.roadGraphics.strokePath();
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
