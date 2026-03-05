// 게임 화면
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// 폰트
export const FONT_FAMILY = "'Jua', Arial, sans-serif";

// 레인 시스템
export const LANE_COUNT = 3;
export const LANE_POSITIONS = [180, 360, 540]; // 좌, 중, 우 (720을 4등분)

// 플레이어
export const PLAYER_Y = 1000;
export const JUMP_VELOCITY = -700;
export const SLIDE_DURATION = 400; // ms

// 물리
export const GRAVITY = 1800;

// 속도 / 난이도
export const BASE_SPEED = 320; // px/s
export const MAX_SPEED = 650;
export const SPEED_INCREMENT = 0.15; // 거리 1당 속도 증가량

// 입력
export const SWIPE_THRESHOLD = 30; // px (모바일 반응성 개선)

// Scene 키
export const SCENE_BOOT = 'Boot';
export const SCENE_PRELOADER = 'Preloader';
export const SCENE_MAIN_MENU = 'MainMenu';
export const SCENE_GAME = 'Game';
export const SCENE_GAME_OVER = 'GameOver';

// 릴렉스 모드 배율
export const RELAX_SPEED_MULTIPLIER = 0.5;
export const RELAX_MAX_SPEED = 455;       // 릴렉스 모드 최대 속도 캡 (일반 MAX_SPEED의 ~70%)
export const RELAX_FREE_REVIVES = 99;     // 릴렉스 모드 사실상 무제한 부활
export const RELAX_OBSTACLE_SKIP = 0.4;   // 릴렉스 모드 장애물 스킵 확률 (40%)

// 레인 이동 Tween
export const LANE_MOVE_DURATION = 150; // ms

// 게임 모드
export type GameMode = 'normal' | 'relax' | 'quest';

// 퀘스트 모드 Scene 키
export const SCENE_QUEST_SELECT = 'QuestSelect';

// 퀘스트 모드: 완료 시 보너스 점수 배율 (목표 달성 보너스)
export const QUEST_COMPLETION_BONUS_SCORE = 500;

// 장애물 시스템
export type ObstacleType = 'rock' | 'branch_high' | 'puddle' | 'barrier' | 'car' | 'snake';

export const OBSTACLE_CONFIGS: Record<ObstacleType, { width: number; height: number; color: number }> = {
    rock:        { width: 80, height: 80, color: 0x808080 },
    branch_high: { width: 100, height: 40, color: 0x8B4513 },
    puddle:      { width: 100, height: 30, color: 0x4FC3F7 },
    barrier:     { width: 160, height: 60, color: 0xFF4444 },  // 2레인 차단
    car:         { width: 80, height: 100, color: 0x3366CC },   // 점프 회피
    snake:       { width: 90, height: 30, color: 0x4CAF50 },   // 뱀 — 넓고 낮음 (점프로만 회피)
};

// 아이템 시스템
export type ItemType = 'mandarin' | 'watermelon' | 'hotspring_material';

export const ITEM_POINTS: Record<ItemType, number> = {
    mandarin: 10,
    watermelon: 30,
    hotspring_material: 50,
};

export const ITEM_WEIGHTS: Record<ItemType, number> = {
    mandarin: 0.6,
    watermelon: 0.25,
    hotspring_material: 0.15,
};

export const ITEM_SIZE = 50;
// 난이도 곡선
export const SPAWN_INTERVAL_START = 900;  // ms (초반 밀도 개선)
export const SPAWN_INTERVAL_MIN = 500;    // ms
export const SPAWN_INTERVAL_DECAY = 0.15; // 거리당 감소량

export const DIFFICULTY_EASY_MAX = 500;   // 거리 (m)
export const DIFFICULTY_MEDIUM_MAX = 1800;

export const ITEM_SPAWN_CHANCE = 0.65;

// 수집 아이템
export interface CollectedItems {
    mandarin: number;
    watermelon: number;
    hotspring_material: number;
}

// 부활 시스템
export const MAX_FREE_REVIVES = 1;
export const INVINCIBLE_DURATION = 3000; // ms

// API
export const API_BASE_URL = '';  // 프록시 사용 시 빈 문자열
export const LS_KEY_TOKEN = 'capybara_token';
export const LS_KEY_USER_ID = 'capybara_user_id';

// 파워업 시스템
export type PowerUpType = 'helmet' | 'tube' | 'friend' | 'magnet';

export const POWERUP_CONFIGS: Record<PowerUpType, { width: number; height: number; color: number; duration: number }> = {
    helmet: { width: 50, height: 50, color: 0x2E7D32, duration: 0 },      // 1회용
    tube:   { width: 50, height: 50, color: 0x1565C0, duration: 8000 },    // 8초
    friend: { width: 50, height: 50, color: 0xFF6F00, duration: 8000 },    // 8초
    magnet: { width: 50, height: 50, color: 0xCC0000, duration: 7000 },    // 7초
};

export const POWERUP_SPAWN_CHANCE = 0.09;
export const MAGNET_Z_RANGE = 0.4;
export const POWERUP_MIN_DISTANCE = 300;
export const POWERUP_SCORE_MULTIPLIER_TUBE = 2;

// 스테이지 시스템
export type StageType = 'forest' | 'river' | 'village' | 'onsen';

export const STAGE_THRESHOLDS: { stage: StageType; minDistance: number }[] = [
    { stage: 'forest',  minDistance: 0 },
    { stage: 'river',   minDistance: 1000 },
    { stage: 'village', minDistance: 3000 },
    { stage: 'onsen',   minDistance: 6000 },
];

export const STAGE_LOOP_DISTANCE = 8000;

export const STAGE_COLORS: Record<StageType, { sky: number; trees: number; ground: number }> = {
    forest:  { sky: 0x87CEEB, trees: 0x228B22, ground: 0x8B4513 },
    river:   { sky: 0xB0E0E6, trees: 0x2F9E9E, ground: 0x5D7A8A },
    village: { sky: 0xFAD6A5, trees: 0xA0522D, ground: 0xC49A6C },
    onsen:   { sky: 0xE8B4D8, trees: 0x9C6B98, ground: 0xB07BA5 },
};

export const STAGE_NAMES: Record<StageType, string> = {
    forest:  '숲속',
    river:   '강가',
    village: '마을',
    onsen:   '온천',
};

export const STAGE_TRANSITION_DURATION = 800;

// 이펙트 상수
export const EFFECT_RED_FLASH_DURATION = 300;
export const EFFECT_SLOWMO_DURATION = 700;
export const EFFECT_SLOWMO_SCALE = 0.25;
export const EFFECT_PARTICLE_LIFESPAN = 400;
export const EFFECT_STAGE_TEXT_DURATION = 2000;
export const DEPTH_EFFECT_OVERLAY = 50;
export const DEPTH_STAGE_TEXT = 250;

// Scene 키
export const SCENE_ONSEN = 'Onsen';
export const SCENE_SKIN_SELECT = 'SkinSelect';

// localStorage 키
export const LS_KEY_INVENTORY = 'capybara_inventory';
export const LS_KEY_ONSEN_LAYOUT = 'capybara_onsen_layout';
export const LS_KEY_SELECTED_SKIN = 'capybara_selected_skin';
export const LS_KEY_UNLOCKED_SKINS = 'capybara_unlocked_skins';

// 인벤토리
export interface Inventory {
    mandarin: number;
    watermelon: number;
    hotspring_material: number;
}

// 온천 꾸미기
export type OnsenLevel = 'basic' | 'forest' | 'snow' | 'luxury';

export interface PlacedItem {
    itemType: ItemType;
    x: number;
    y: number;
}

export interface OnsenLayout {
    placedItems: PlacedItem[];
}

export const ONSEN_LEVEL_THRESHOLDS: { level: OnsenLevel; minItems: number }[] = [
    { level: 'basic', minItems: 0 },
    { level: 'forest', minItems: 15 },
    { level: 'snow', minItems: 35 },
    { level: 'luxury', minItems: 60 },
];

export const ONSEN_LEVEL_COLORS: Record<OnsenLevel, { bg: number; water: number; rim: number }> = {
    basic:  { bg: 0xD2B48C, water: 0x87CEEB, rim: 0x8B7355 },
    forest: { bg: 0x228B22, water: 0x4FC3F7, rim: 0x6B8E23 },
    snow:   { bg: 0xF0F0F0, water: 0xB0E0E6, rim: 0xC0C0C0 },
    luxury: { bg: 0xFFD700, water: 0xFF69B4, rim: 0xDAA520 },
};

export const ONSEN_LEVEL_NAMES: Record<OnsenLevel, string> = {
    basic:  '기본 온천',
    forest: '숲속 온천',
    snow:   '설경 온천',
    luxury: '럭셔리 온천',
};

// 캐릭터 스킨
export type SkinId = 'default' | 'towel' | 'yukata' | 'santa';
export type UnlockCondition = 'always' | 'distance_5000' | 'onsen_level_3' | 'items_1000';

export interface SkinConfig {
    id: SkinId;
    name: string;
    color: number;
    unlockCondition: UnlockCondition;
    unlockDescription: string;
}

export const SKIN_CONFIGS: SkinConfig[] = [
    { id: 'default', name: '기본 카피바라',  color: 0x8B6914, unlockCondition: 'always', unlockDescription: '기본' },
    { id: 'towel',   name: '수건 카피바라',  color: 0xF5F5DC, unlockCondition: 'distance_5000', unlockDescription: '5,000m 달리기' },
    { id: 'yukata',  name: '유카타 카피바라', color: 0x8B008B, unlockCondition: 'onsen_level_3', unlockDescription: '온천 레벨 3 (설경)' },
    { id: 'santa',   name: '산타 카피바라',   color: 0xCC0000, unlockCondition: 'items_1000', unlockDescription: '아이템 1,000개 수집' },
];

// 온천 Scene 상수
export const ONSEN_POOL_X = 110;
export const ONSEN_POOL_Y = 150;
export const ONSEN_POOL_W = 500;
export const ONSEN_POOL_H = 300;
export const ONSEN_INVENTORY_START_Y = 590;
export const ONSEN_ITEM_DISPLAY_SIZE = 60;

// localStorage 키 (maxDistance)
export const LS_KEY_MAX_DISTANCE = 'capybara_max_distance';
export const LS_KEY_TUTORIAL_DONE = 'capybara_tutorial_done';

// 의사-3D 원근 시스템
export const VANISH_Y = 350;       // 소실점 Y (화면 상단)
export const CAMERA_Y = 1100;      // 카메라 Y (화면 하단)
export const CENTER_X = 360;       // 화면 가로 중앙
export const ROAD_HEIGHT = CAMERA_Y - VANISH_Y; // 750
export const ROAD_WIDTH_NEAR = 600; // 카메라 근처 도로 폭
export const ROAD_WIDTH_FAR = 80;   // 소실점 근처 도로 폭
export const LANE_SPREAD = 170;     // 레인 오프셋 배율 (near)

// z좌표 체계: 1.0 = 소실점(멀리), 0.0 = 카메라(가까이)
export const SPAWN_Z = 0.75;        // 오브젝트 스폰 z (0.92→0.75: 가시성 향상)
export const DESPAWN_Z = -0.05;     // 오브젝트 디스폰 z
export const PLAYER_Z = 0.08;       // 플레이어 고정 z

// 충돌 밴드 (z 범위 내에서만 physics body 활성)
export const COLLISION_BAND = 0.08;

// 도로 렌더링
export const ROAD_SEGMENTS = 60;    // 도로 세그먼트 수
export const DASH_LENGTH = 0.03;    // 대시 마킹 z 길이
export const ROAD_STRIPE_COUNT = 8; // 이동 대시 마킹 개수

// 코인 라인 (골드런 스타일)
export const COIN_LINE_LENGTH = 6;    // 코인 줄 길이
export const COIN_LINE_Z_GAP = 0.04;  // 코인 간 z 간격

// 코인 패턴 종류
export type CoinPattern = 'line' | 'arc' | 'zigzag';

// 풀 사이즈 증가 (z-스폰으로 동시 활성 오브젝트 증가)
export const OBSTACLE_POOL_SIZE_3D = 12;
export const ITEM_POOL_SIZE_3D = 30;
export const POWERUP_POOL_SIZE_3D = 6;

// 레인 오프셋: -1, 0, +1
export const LANE_OFFSETS = [-1, 0, 1];

// 온천 버프 시스템
export interface OnsenBuff {
    scoreMultiplier: number;
    startingShield: boolean;
    itemMagnetRange: number;
}

export const ONSEN_BUFF_CONFIGS: Record<OnsenLevel, OnsenBuff> = {
    basic:  { scoreMultiplier: 1.0, startingShield: false, itemMagnetRange: 0 },
    forest: { scoreMultiplier: 1.1, startingShield: false, itemMagnetRange: 50 },
    snow:   { scoreMultiplier: 1.2, startingShield: true,  itemMagnetRange: 100 },
    luxury: { scoreMultiplier: 1.3, startingShield: true,  itemMagnetRange: 150 },
};

// 일일 미션
export const SCENE_MISSIONS = 'Missions';
export type MissionType = 'collect_mandarins' | 'run_distance' | 'dodge_obstacles';
export const MISSION_LABELS: Record<MissionType, string> = {
    collect_mandarins: '귤 수집',
    run_distance: '달리기 거리',
    dodge_obstacles: '장애물 회피',
};

export const LS_KEY_DAILY_MISSIONS = 'capybara_daily_missions';
export const LS_KEY_STREAK = 'capybara_streak';

// 동물 친구 시스템
export const SCENE_COMPANION_SELECT = 'CompanionSelect';
export const LS_KEY_SELECTED_COMPANION = 'capybara_selected_companion';
export const LS_KEY_UNLOCKED_COMPANIONS = 'capybara_unlocked_companions';

export type CompanionId = 'none' | 'otter' | 'duck' | 'turtle';
export type CompanionUnlockCondition = 'always' | 'distance_2000' | 'distance_3000' | 'items_500' | 'onsen_level_2';

export interface CompanionAbility {
    scoreMultiplier: number;
    shieldChance: number;
    itemMagnetRange: number;
}

export interface CompanionConfig {
    id: CompanionId;
    name: string;
    color: number;
    emoji: string;
    unlockCondition: CompanionUnlockCondition;
    unlockDescription: string;
    abilityDescription: string;
    ability: CompanionAbility;
}

export const COMPANION_CONFIGS: CompanionConfig[] = [
    {
        id: 'otter', name: '수달', color: 0x6B4226, emoji: '🦦',
        unlockCondition: 'distance_3000', unlockDescription: '3,000m 달리기',
        abilityDescription: '아이템 자석 (100px)',
        ability: { scoreMultiplier: 1.0, shieldChance: 0, itemMagnetRange: 100 },
    },
    {
        id: 'duck', name: '오리', color: 0xFFD700, emoji: '🦆',
        unlockCondition: 'items_500', unlockDescription: '아이템 500개 수집',
        abilityDescription: '점수 1.2배',
        ability: { scoreMultiplier: 1.2, shieldChance: 0, itemMagnetRange: 0 },
    },
    {
        id: 'turtle', name: '거북이', color: 0x2E8B57, emoji: '🐢',
        unlockCondition: 'onsen_level_2', unlockDescription: '온천 레벨 2 (숲속)',
        abilityDescription: '15% 확률 방어',
        ability: { scoreMultiplier: 1.0, shieldChance: 0.15, itemMagnetRange: 0 },
    },
];

export const NO_COMPANION_ABILITY: CompanionAbility = {
    scoreMultiplier: 1.0, shieldChance: 0, itemMagnetRange: 0,
};

export const VALID_COMPANION_IDS = new Set<string>(
    ['none', ...COMPANION_CONFIGS.map(c => c.id)]
);
