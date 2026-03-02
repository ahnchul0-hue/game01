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
} from '../utils/Constants';
import type { ObstacleType } from '../utils/Constants';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export class DifficultyManager {
    getSpeed(distance: number, isRelax: boolean): number {
        const base = Math.min(BASE_SPEED + distance * SPEED_INCREMENT, MAX_SPEED);
        const multiplier = isRelax ? RELAX_SPEED_MULTIPLIER : 1;
        return base * multiplier;
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

    getAvailableObstacleTypes(level: DifficultyLevel): ObstacleType[] {
        if (level === 'easy') return ['rock'];
        if (level === 'medium') return ['rock', 'branch_high', 'puddle'];
        return ['rock', 'branch_high', 'puddle', 'barrier', 'car'];
    }

    getMaxObstaclesPerSpawn(level: DifficultyLevel): number {
        return level === 'hard' ? 2 : 1;
    }
}
