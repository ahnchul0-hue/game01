import Phaser from 'phaser';
import {
    GAME_WIDTH,
    VANISH_Y,
    CENTER_X,
    BASE_SPEED,
    MAX_SPEED,
} from '../utils/Constants';

const SPEED_LINE_COUNT = 12;
const SPEED_THRESHOLD = 0.5; // 최대 속도의 50% 이상에서 표시

/**
 * 소실점에서 방사형으로 뻗어나가는 속도선.
 * gameSpeed에 비례하여 강도 조절.
 */
export class SpeedLineRenderer {
    private graphics: Phaser.GameObjects.Graphics;
    private animOffset = 0;

    constructor(scene: Phaser.Scene) {
        this.graphics = scene.add.graphics().setDepth(3);
    }

    update(gameSpeed: number, dt: number): void {
        this.graphics.clear();

        // 속도 비율 (0~1)
        const speedRatio = (gameSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
        if (speedRatio < SPEED_THRESHOLD) return;

        // 강도 (0~1)
        const intensity = (speedRatio - SPEED_THRESHOLD) / (1 - SPEED_THRESHOLD);
        const alpha = 0.15 * intensity;

        this.animOffset += dt * 2;

        this.graphics.lineStyle(1, 0xFFFFFF, alpha);

        for (let i = 0; i < SPEED_LINE_COUNT; i++) {
            const angle = (i / SPEED_LINE_COUNT) * Math.PI * 2 + this.animOffset;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // 소실점에서 시작, 화면 가장자리로 뻗어나감
            const startR = 30;
            const endR = 200 + intensity * 300;

            const x1 = CENTER_X + cos * startR;
            const y1 = VANISH_Y + sin * startR * 0.4; // Y축 압축 (원근)
            const x2 = CENTER_X + cos * endR;
            const y2 = VANISH_Y + sin * endR * 0.4;

            // 화면 안에 있는 것만
            if (x2 < -50 || x2 > GAME_WIDTH + 50) continue;
            if (y2 < -50) continue;

            this.graphics.beginPath();
            this.graphics.moveTo(x1, y1);
            this.graphics.lineTo(x2, y2);
            this.graphics.strokePath();
        }
    }

    destroy(): void {
        this.graphics.destroy();
    }
}
