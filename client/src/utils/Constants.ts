// 게임 화면
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// 레인 시스템
export const LANE_COUNT = 3;
export const LANE_POSITIONS = [180, 360, 540]; // 좌, 중, 우 (720을 4등분)

// 플레이어
export const PLAYER_Y = 1000;
export const JUMP_VELOCITY = -500;
export const SLIDE_DURATION = 500; // ms

// 물리
export const GRAVITY = 800;

// 속도 / 난이도
export const BASE_SPEED = 300; // px/s
export const MAX_SPEED = 800;
export const SPEED_INCREMENT = 0.01; // 거리 1당 속도 증가량

// 입력
export const SWIPE_THRESHOLD = 50; // px

// Scene 키
export const SCENE_BOOT = 'Boot';
export const SCENE_PRELOADER = 'Preloader';
export const SCENE_MAIN_MENU = 'MainMenu';
export const SCENE_GAME = 'Game';
export const SCENE_GAME_OVER = 'GameOver';

// 릴렉스 모드 배율
export const RELAX_SPEED_MULTIPLIER = 0.5;

// 레인 이동 Tween
export const LANE_MOVE_DURATION = 150; // ms

// 게임 모드
export type GameMode = 'normal' | 'relax';

// ========== M2: 장애물 시스템 ==========
export type ObstacleType = 'rock' | 'branch_high' | 'puddle';

export const OBSTACLE_CONFIGS: Record<ObstacleType, { width: number; height: number; color: number }> = {
    rock:        { width: 80, height: 80, color: 0x808080 },
    branch_high: { width: 100, height: 40, color: 0x8B4513 },
    puddle:      { width: 100, height: 30, color: 0x4FC3F7 },
};

export const OBSTACLE_POOL_SIZE = 10;

// ========== M2: 아이템 시스템 ==========
export type ItemType = 'mandarin' | 'watermelon' | 'hotspring_material';

export const ITEM_POINTS: Record<ItemType, number> = {
    mandarin: 10,
    watermelon: 30,
    hotspring_material: 50,
};

export const ITEM_WEIGHTS: Record<ItemType, number> = {
    mandarin: 0.7,
    watermelon: 0.2,
    hotspring_material: 0.1,
};

export const ITEM_SIZE = 50;
export const ITEM_POOL_SIZE = 15;

// ========== M2: 스폰/디스폰 ==========
export const SPAWN_Y = -100;
export const DESPAWN_Y = GAME_HEIGHT + 100;

// ========== M2: 난이도 곡선 ==========
export const SPAWN_INTERVAL_START = 2000; // ms
export const SPAWN_INTERVAL_MIN = 600;    // ms
export const SPAWN_INTERVAL_DECAY = 0.5;  // 거리당 감소량

export const DIFFICULTY_EASY_MAX = 500;   // 거리 (m)
export const DIFFICULTY_MEDIUM_MAX = 2000;

export const ITEM_SPAWN_CHANCE = 0.6;

// ========== M2: 수집 아이템 ==========
export interface CollectedItems {
    mandarin: number;
    watermelon: number;
    hotspring_material: number;
}

// ========== M2: 부활 시스템 ==========
export const MAX_FREE_REVIVES = 1;
export const INVINCIBLE_DURATION = 2000; // ms

// ========== M2: API ==========
export const API_BASE_URL = '';  // 프록시 사용 시 빈 문자열
export const LS_KEY_TOKEN = 'capybara_token';
export const LS_KEY_USER_ID = 'capybara_user_id';
