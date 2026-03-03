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
        const cap = isRelax ? RELAX_MAX_SPEED : MAX_SPEED;
        const base = Math.min(BASE_SPEED + distance * SPEED_INCREMENT, cap);
        return isRelax ? base * RELAX_SPEED_MULTIPLIER : base;
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
        if (level === 'medium') return ['rock', 'branch_high', 'puddle'];
        return ['rock', 'branch_high', 'puddle', 'barrier', 'car'];
    }

    getMaxObstaclesPerSpawn(level: DifficultyLevel, isRelax = false): number {
        if (isRelax) return 1;
        return level === 'hard' ? 2 : 1;
    }
}
