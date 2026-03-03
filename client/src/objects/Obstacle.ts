import Phaser from 'phaser';
import { PerspectiveCamera } from '../systems/PerspectiveCamera';
import {
    DESPAWN_Z,
    PLAYER_Z,
    COLLISION_BAND,
    OBSTACLE_CONFIGS,
} from '../utils/Constants';
import type { ObstacleType } from '../utils/Constants';

export class Obstacle extends Phaser.Physics.Arcade.Sprite {
    obstacleType: ObstacleType = 'rock';

    /** 깊이 좌표 (1=소실점, 0=카메라) */
    z = 1;
    /** 레인 오프셋 (-1, 0, 1) */
    laneOffset = 0;
    /** z 이동 속도 (units/s) */
    private zSpeed = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'obstacle-rock');
        this.setActive(false);
        this.setVisible(false);
    }

    activate(lane: number, z: number, type: ObstacleType, zSpeed: number): void {
        this.obstacleType = type;
        this.laneOffset = lane;
        this.z = z;
        this.zSpeed = zSpeed;
        this.setTexture(`obstacle-${type}`);

        // 초기 투영
        const { screenY, scale } = PerspectiveCamera.projectZ(z);
        const screenX = PerspectiveCamera.getLaneScreenX(z, lane);
        this.setPosition(screenX, screenY);
        this.setScale(scale);

        // physics body 설정
        const config = OBSTACLE_CONFIGS[type];
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(config.width, config.height);
        body.setOffset(
            (this.width - config.width) / 2,
            (this.height - config.height) / 2,
        );
        // 충돌 밴드 밖에서 시작 → body 비활성
        body.enable = false;
        this.setVelocity(0, 0);

        this.setActive(true);
        this.setVisible(true);
    }

    deactivate(): void {
        this.setActive(false);
        this.setVisible(false);
        this.setVelocity(0, 0);
        if (this.body) {
            const body = this.body as Phaser.Physics.Arcade.Body;
            body.enable = false;
            body.reset(0, 0);
        }
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);
        if (!this.active) return;

        // z 이동 (z 감소 = 카메라로 접근)
        const dt = delta / 1000;
        this.z -= this.zSpeed * dt;

        // 디스폰
        if (this.z < DESPAWN_Z) {
            this.deactivate();
            return;
        }

        // 원근 투영
        const { screenY, scale } = PerspectiveCamera.projectZ(this.z);
        const screenX = PerspectiveCamera.getLaneScreenX(this.z, this.laneOffset);
        this.setPosition(screenX, screenY);
        this.setScale(scale);

        // 깊이 정렬 (가까울수록 위에, 플레이어 depth 10 위)
        this.setDepth(12 + (1 - this.z) * 7);

        // 거리 기반 안개 알파 (먼 오브젝트는 약간 투명)
        this.setAlpha(Math.min(1, 0.4 + scale * 0.7));

        // 충돌 밴드 체크: 플레이어 z 근처에서만 body 활성화
        const body = this.body as Phaser.Physics.Arcade.Body;
        const inBand = Math.abs(this.z - PLAYER_Z) < COLLISION_BAND;
        body.enable = inBand;
    }
}
