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
