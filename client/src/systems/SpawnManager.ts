import { ObstaclePool } from '../pools/ObstaclePool';
import { ItemPool } from '../pools/ItemPool';
import { DifficultyManager } from './DifficultyManager';
import {
    LANE_POSITIONS,
    SPAWN_Y,
    ITEM_SPAWN_CHANCE,
    ITEM_WEIGHTS,
    SPAWN_INTERVAL_START,
} from '../utils/Constants';
import type { ItemType } from '../utils/Constants';

export class SpawnManager {
    private obstaclePool: ObstaclePool;
    private itemPool: ItemPool;
    private difficulty: DifficultyManager;
    private spawnTimer = 0;
    private currentInterval = SPAWN_INTERVAL_START;

    constructor(obstaclePool: ObstaclePool, itemPool: ItemPool, difficulty: DifficultyManager) {
        this.obstaclePool = obstaclePool;
        this.itemPool = itemPool;
        this.difficulty = difficulty;
    }

    update(delta: number, distance: number, gameSpeed: number, isRelax: boolean): void {
        this.spawnTimer += delta;
        this.currentInterval = this.difficulty.getSpawnInterval(distance, isRelax);

        if (this.spawnTimer < this.currentInterval) return;
        this.spawnTimer = 0;
        this.spawnWave(distance, gameSpeed);
    }

    private spawnWave(distance: number, gameSpeed: number): void {
        const level = this.difficulty.getLevel(distance);
        const types = this.difficulty.getAvailableObstacleTypes(level);
        const maxObstacles = this.difficulty.getMaxObstaclesPerSpawn(level);

        // 레인 셔플 (Fisher-Yates)
        const lanes = [0, 1, 2];
        for (let i = lanes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
        }

        // 장애물 배치 (최대 2개 — 최소 1레인 비움)
        const obstacleCount = Math.min(maxObstacles, 2);
        const usedLanes: number[] = [];

        for (let i = 0; i < obstacleCount; i++) {
            const lane = lanes[i];
            const type = types[Math.floor(Math.random() * types.length)];
            this.obstaclePool.spawn(LANE_POSITIONS[lane], SPAWN_Y, type, gameSpeed);
            usedLanes.push(lane);
        }

        // 남은 레인에 아이템 배치 (확률 기반)
        for (let i = obstacleCount; i < lanes.length; i++) {
            if (Math.random() < ITEM_SPAWN_CHANCE) {
                const itemType = this.weightedRandom();
                this.itemPool.spawn(LANE_POSITIONS[lanes[i]], SPAWN_Y, itemType, gameSpeed);
            }
        }
    }

    private weightedRandom(): ItemType {
        const entries = Object.entries(ITEM_WEIGHTS) as [ItemType, number][];
        const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
        let random = Math.random() * totalWeight;

        for (const [type, weight] of entries) {
            random -= weight;
            if (random <= 0) return type;
        }

        return entries[0][0];
    }

    reset(): void {
        this.spawnTimer = 0;
        this.obstaclePool.deactivateAll();
        this.itemPool.deactivateAll();
    }
}
