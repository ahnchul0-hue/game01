import {
    BASE_SPEED,
    MAX_SPEED,
    SPEED_INCREMENT,
    SPAWN_INTERVAL_START,
    SPAWN_INTERVAL_MIN,
    SPAWN_INTERVAL_DECAY,
    DIFFICULTY_EASY_MAX,
    DIFFICULTY_MEDIUM_MAX,
    RELAX_SPEED_MULTIPLIER,
    RELAX_MAX_SPEED,
} from '../utils/Constants';
import type { ObstacleType } from '../utils/Constants';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export class DifficultyManager {
    getSpeed(distance: number, isRelax: boolean): number {
        if (isRelax) {
            // 릴렉스: 기본속도에 배율 적용 후 전용 캡으로 제한 (이중 감속 방지)
            const relaxBase = (BASE_SPEED + distance * SPEED_INCREMENT) * RELAX_SPEED_MULTIPLIER;
            return Math.min(relaxBase, RELAX_MAX_SPEED);
        }
        return Math.min(BASE_SPEED + distance * SPEED_INCREMENT, MAX_SPEED);
    }

    getSpawnInterval(distance: number, isRelax: boolean): number {
        const raw = Math.max(
            SPAWN_INTERVAL_START - distance * SPAWN_INTERVAL_DECAY,
            SPAWN_INTERVAL_MIN,
        );
        return isRelax ? raw * 1.5 : raw;
    }

    getLevel(distance: number): DifficultyLevel {
        if (distance < DIFFICULTY_EASY_MAX) return 'easy';
        if (distance < DIFFICULTY_MEDIUM_MAX) return 'medium';
        return 'hard';
    }

    getAvailableObstacleTypes(level: DifficultyLevel, isRelax = false): ObstacleType[] {
        if (isRelax) return ['rock', 'puddle'];
        if (level === 'easy') return ['rock'];
        if (level === 'medium') return ['rock', 'branch_high', 'puddle', 'barrier'];
        return ['rock', 'branch_high', 'puddle', 'barrier', 'car', 'snake'];
    }

    getMaxObstaclesPerSpawn(level: DifficultyLevel, isRelax = false): number {
        if (isRelax) return 1;
        return level === 'hard' ? 2 : 1;
    }
}
