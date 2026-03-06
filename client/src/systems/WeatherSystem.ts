/**
 * WeatherSystem — 비주얼 날씨 + 하늘 그라데이션 시스템.
 *
 * 스테이지/거리에 따라 날씨가 변화하며, ASMR ambient와 자동 연동.
 * - forest: 맑음 → 벚꽃잎 (800m+)
 * - river:  안개 → 비 (1500m+)
 * - village: 맑음 → 눈 (3500m+)
 * - onsen:  수증기
 *
 * Phaser Graphics 기반 하늘 오버레이 + 경량 파티클.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ROAD_HEIGHT } from '../utils/Constants';
import type { StageType } from '../utils/Constants';
import type { AmbientName } from '../services/SoundManager';

type WeatherType = 'clear' | 'rain' | 'snow' | 'petals' | 'steam';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    rotation?: number;
}

// 하늘 시간 색상 (거리에 따라 새벽→낮→노을→밤 순환)
const SKY_CYCLE = [
    { dist: 0,    top: 0x1a1a3e, bottom: 0x4a3070 },  // 새벽
    { dist: 500,  top: 0x87CEEB, bottom: 0xE0F0FF },  // 낮
    { dist: 2000, top: 0xFF9E5E, bottom: 0xFFD4A8 },  // 노을
    { dist: 3500, top: 0x1a1a3e, bottom: 0x2a2a5e },  // 밤
    { dist: 5000, top: 0x87CEEB, bottom: 0xE0F0FF },  // 다시 낮 (루프)
];

const STAGE_WEATHER: Record<StageType, { type: WeatherType; minDistance: number }> = {
    forest:  { type: 'petals',  minDistance: 800 },
    river:   { type: 'rain',    minDistance: 1500 },
    village: { type: 'snow',    minDistance: 3500 },
    onsen:   { type: 'steam',   minDistance: 0 },
};

const MAX_PARTICLES = 60;
const SKY_TOP_Y = 0;
const SKY_BOTTOM_Y = GAME_HEIGHT - ROAD_HEIGHT;

export class WeatherSystem {
    private skyGraphics: Phaser.GameObjects.Graphics;
    private weatherGraphics: Phaser.GameObjects.Graphics;
    private particles: Particle[] = [];
    private currentWeather: WeatherType = 'clear';
    private currentSkyTop = 0x87CEEB;
    private currentSkyBottom = 0xE0F0FF;
    private targetSkyTop = 0x87CEEB;
    private targetSkyBottom = 0xE0F0FF;
    private weatherIntensity = 0; // 0~1 fade in

    constructor(scene: Phaser.Scene) {
        // 하늘 오버레이 (depth 0: 모든 게임 오브젝트 뒤)
        this.skyGraphics = scene.add.graphics();
        this.skyGraphics.setDepth(0);

        // 날씨 파티클 (depth 25: HUD 아래, 게임 오브젝트 위)
        this.weatherGraphics = scene.add.graphics();
        this.weatherGraphics.setDepth(25);
    }

    update(distance: number, stage: StageType, dt: number): void {
        this.updateSky(distance, dt);
        this.updateWeather(distance, stage, dt);
        this.renderParticles();
    }

    private updateSky(distance: number, dt: number): void {
        // 거리 기반 목표 색상 산출
        const loopDist = distance % 5000;
        let from = SKY_CYCLE[0], to = SKY_CYCLE[1];
        for (let i = 0; i < SKY_CYCLE.length - 1; i++) {
            if (loopDist >= SKY_CYCLE[i].dist && loopDist < SKY_CYCLE[i + 1].dist) {
                from = SKY_CYCLE[i];
                to = SKY_CYCLE[i + 1];
                break;
            }
        }
        const t = (loopDist - from.dist) / (to.dist - from.dist);
        this.targetSkyTop = lerpColor(from.top, to.top, t);
        this.targetSkyBottom = lerpColor(from.bottom, to.bottom, t);

        // 부드러운 전환 (lerp)
        const speed = Math.min(1, dt * 2);
        this.currentSkyTop = lerpColor(this.currentSkyTop, this.targetSkyTop, speed);
        this.currentSkyBottom = lerpColor(this.currentSkyBottom, this.targetSkyBottom, speed);

        // 그라데이션 렌더링
        this.skyGraphics.clear();
        const steps = 8;
        const stepH = SKY_BOTTOM_Y / steps;
        for (let i = 0; i < steps; i++) {
            const c = lerpColor(this.currentSkyTop, this.currentSkyBottom, i / (steps - 1));
            this.skyGraphics.fillStyle(c, 0.6);
            this.skyGraphics.fillRect(0, SKY_TOP_Y + i * stepH, GAME_WIDTH, stepH + 1);
        }
    }

    private updateWeather(distance: number, stage: StageType, dt: number): void {
        const config = STAGE_WEATHER[stage];
        const shouldActive = distance >= config.minDistance;
        const targetType = shouldActive ? config.type : 'clear';

        if (targetType !== this.currentWeather) {
            this.currentWeather = targetType;
            this.weatherIntensity = 0;
        }

        // 점진적 강도 증가
        if (this.currentWeather !== 'clear' && this.weatherIntensity < 1) {
            this.weatherIntensity = Math.min(1, this.weatherIntensity + dt * 0.5);
        }

        // 파티클 생성
        if (this.currentWeather !== 'clear') {
            const spawnRate = MAX_PARTICLES * this.weatherIntensity;
            while (this.particles.length < spawnRate) {
                this.particles.push(this.spawnParticle(this.currentWeather));
            }
        }

        // 파티클 업데이트
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.rotation !== undefined) p.rotation += dt * 2;

            // 화면 밖 제거
            if (p.y > GAME_HEIGHT || p.x < -20 || p.x > GAME_WIDTH + 20) {
                this.particles.splice(i, 1);
            }
        }
    }

    private spawnParticle(type: WeatherType): Particle {
        const base: Particle = {
            x: Math.random() * GAME_WIDTH,
            y: -10,
            vx: 0,
            vy: 0,
            size: 2,
            alpha: 0.6,
        };

        switch (type) {
            case 'rain':
                base.vx = -30 + Math.random() * 10;
                base.vy = 400 + Math.random() * 200;
                base.size = 1.5;
                base.alpha = 0.4 + Math.random() * 0.3;
                break;
            case 'snow':
                base.vx = -20 + Math.random() * 40;
                base.vy = 40 + Math.random() * 60;
                base.size = 2 + Math.random() * 3;
                base.alpha = 0.5 + Math.random() * 0.4;
                break;
            case 'petals':
                base.vx = 20 + Math.random() * 40;
                base.vy = 30 + Math.random() * 50;
                base.size = 3 + Math.random() * 3;
                base.alpha = 0.5 + Math.random() * 0.3;
                base.rotation = Math.random() * Math.PI * 2;
                break;
            case 'steam':
                base.y = GAME_HEIGHT * 0.7 + Math.random() * GAME_HEIGHT * 0.2;
                base.vx = -5 + Math.random() * 10;
                base.vy = -(20 + Math.random() * 30);
                base.size = 8 + Math.random() * 12;
                base.alpha = 0.1 + Math.random() * 0.15;
                break;
        }

        return base;
    }

    private renderParticles(): void {
        this.weatherGraphics.clear();

        for (const p of this.particles) {
            switch (this.currentWeather) {
                case 'rain':
                    this.weatherGraphics.lineStyle(p.size, 0xAABBDD, p.alpha * this.weatherIntensity);
                    this.weatherGraphics.lineBetween(p.x, p.y, p.x - 3, p.y + 12);
                    break;
                case 'snow':
                    this.weatherGraphics.fillStyle(0xFFFFFF, p.alpha * this.weatherIntensity);
                    this.weatherGraphics.fillCircle(p.x, p.y, p.size);
                    break;
                case 'petals':
                    this.weatherGraphics.fillStyle(0xFFB7C5, p.alpha * this.weatherIntensity);
                    this.weatherGraphics.fillEllipse(p.x, p.y, p.size * 1.5, p.size);
                    break;
                case 'steam':
                    this.weatherGraphics.fillStyle(0xFFFFFF, p.alpha * this.weatherIntensity);
                    this.weatherGraphics.fillCircle(p.x, p.y, p.size);
                    break;
            }
        }
    }

    /** 날씨에 대응하는 ASMR ambient 이름 반환 (연동용). null이면 변경 불필요. */
    getWeatherAmbient(): AmbientName | null {
        switch (this.currentWeather) {
            case 'rain':   return 'ambient-rain';
            case 'petals': return 'ambient-birds';
            case 'steam':  return 'ambient-stream';
            default:       return null;
        }
    }

    destroy(): void {
        this.skyGraphics.destroy();
        this.weatherGraphics.destroy();
        this.particles.length = 0;
    }
}

/** 두 RGB 정수 색상 사이 선형 보간 */
function lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
    const br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
}
