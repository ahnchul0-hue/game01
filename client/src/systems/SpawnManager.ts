import { ObstaclePool } from '../pools/ObstaclePool';
import { ItemPool } from '../pools/ItemPool';
import { PowerUpPool } from '../pools/PowerUpPool';
import { DifficultyManager } from './DifficultyManager';
import {
    SPAWN_Z,
    COIN_LINE_LENGTH,
    COIN_LINE_Z_GAP,
    ITEM_SPAWN_CHANCE,
    SPAWN_INTERVAL_START,
    LANE_OFFSETS,
} from '../utils/Constants';
import type { CoinPattern } from '../utils/Constants';
import { shouldSpawnPowerUp, weightedRandomItem, randomPowerUpType, randomCoinPattern } from '../utils/GameLogic';

/**
 * z 기반 스폰 매니저.
 * 오브젝트를 z=SPAWN_Z(소실점 근처)에 생성.
 * 코인 라인 패턴: 한 레인에 z축으로 연속 배치.
 */
export class SpawnManager {
    private obstaclePool: ObstaclePool;
    private itemPool: ItemPool;
    private powerUpPool: PowerUpPool;
    private difficulty: DifficultyManager;
    private spawnTimer = 0;
    private currentInterval = SPAWN_INTERVAL_START;

    constructor(
        obstaclePool: ObstaclePool,
        itemPool: ItemPool,
        powerUpPool: PowerUpPool,
        difficulty: DifficultyManager,
    ) {
        this.obstaclePool = obstaclePool;
        this.itemPool = itemPool;
        this.powerUpPool = powerUpPool;
        this.difficulty = difficulty;
    }

    /**
     * @param delta ms
     * @param distance 현재 주행 거리
     * @param gameSpeed px/s (zSpeed로 변환)
     * @param isRelax 릴렉스 모드 여부
     */
    update(delta: number, distance: number, gameSpeed: number, isRelax: boolean): void {
        this.spawnTimer += delta;
        this.currentInterval = this.difficulty.getSpawnInterval(distance, isRelax);

        if (this.spawnTimer < this.currentInterval) return;
        this.spawnTimer = 0;

        // gameSpeed(px/s)를 zSpeed(z-units/s)로 변환
        // 도로 750px에 z 범위 0~1이므로: zSpeed = gameSpeed / 750
        const zSpeed = gameSpeed / 750;
        this.spawnWave(distance, zSpeed);
    }

    private spawnWave(distance: number, zSpeed: number): void {
        const level = this.difficulty.getLevel(distance);
        const types = this.difficulty.getAvailableObstacleTypes(level);
        const maxObstacles = this.difficulty.getMaxObstaclesPerSpawn(level);

        // 레인 셔플 (Fisher-Yates)
        const lanes = [...LANE_OFFSETS]; // [-1, 0, 1]
        for (let i = lanes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
        }

        // barrier 특수 처리: 2레인 차단, 반드시 1레인 남김
        const type0 = types[Math.floor(Math.random() * types.length)];
        if (type0 === 'barrier') {
            // barrier는 2레인(중앙 + 한쪽) 차지
            const barrierLane = 0; // 중앙에 배치
            this.obstaclePool.spawn(barrierLane, SPAWN_Z, 'barrier', zSpeed);
            // 남은 1레인(둘 중 하나)에 아이템
            const freeLane = Math.random() < 0.5 ? -1 : 1;
            this.spawnItemsInLane(freeLane, SPAWN_Z, zSpeed, distance);
            return;
        }

        // 일반 장애물 배치
        const obstacleCount = Math.min(maxObstacles, 2);
        for (let i = 0; i < obstacleCount; i++) {
            const lane = lanes[i];
            const type = types[Math.floor(Math.random() * types.length)];
            // barrier는 위에서 처리했으므로 여기선 일반 타입만
            const safeType = type === 'barrier' ? 'rock' : type;
            this.obstaclePool.spawn(lane, SPAWN_Z, safeType, zSpeed);
        }

        // 남은 레인에 아이템/파워업
        for (let i = obstacleCount; i < lanes.length; i++) {
            this.spawnItemsInLane(lanes[i], SPAWN_Z, zSpeed, distance);
        }
    }

    /** 한 레인에 아이템/파워업 배치 */
    private spawnItemsInLane(lane: number, baseZ: number, zSpeed: number, distance: number): void {
        if (shouldSpawnPowerUp(distance, Math.random())) {
            const puType = randomPowerUpType(Math.random());
            this.powerUpPool.spawn(lane, baseZ, puType, zSpeed);
        } else if (Math.random() < ITEM_SPAWN_CHANCE) {
            const pattern = randomCoinPattern(Math.random());
            this.spawnCoinPattern(lane, baseZ, zSpeed, pattern);
        }
    }

    /** 코인 패턴별 배치 */
    private spawnCoinPattern(lane: number, baseZ: number, zSpeed: number, pattern: CoinPattern): void {
        const itemType = weightedRandomItem(Math.random());

        switch (pattern) {
            case 'line':
                // 한 레인 직선
                for (let c = 0; c < COIN_LINE_LENGTH; c++) {
                    this.itemPool.spawn(lane, baseZ - c * COIN_LINE_Z_GAP, itemType, zSpeed);
                }
                break;

            case 'arc':
                // 포물선 (같은 레인, Y 오프셋은 z로 시뮬레이션)
                for (let c = 0; c < COIN_LINE_LENGTH; c++) {
                    const coinZ = baseZ - c * COIN_LINE_Z_GAP;
                    this.itemPool.spawn(lane, coinZ, itemType, zSpeed);
                }
                break;

            case 'zigzag': {
                // 레인을 번갈아 배치
                const altLanes = [lane, lane === 0 ? (Math.random() < 0.5 ? -1 : 1) : -lane];
                for (let c = 0; c < COIN_LINE_LENGTH; c++) {
                    const zigLane = altLanes[c % 2];
                    const coinZ = baseZ - c * COIN_LINE_Z_GAP;
                    this.itemPool.spawn(zigLane, coinZ, itemType, zSpeed);
                }
                break;
            }
        }
    }

    reset(): void {
        this.spawnTimer = 0;
        this.obstaclePool.deactivateAll();
        this.itemPool.deactivateAll();
        this.powerUpPool.deactivateAll();
    }
}
