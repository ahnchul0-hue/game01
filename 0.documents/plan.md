# STEP 2. 계획 — plan.md

> 아직 구현하지 않음. 계획만 작성.

## 게임 기본 사양

| 항목 | 값 |
|------|-----|
| 해상도 | 720 x 1280 (세로, Portrait) |
| 방향 | 세로 고정 |
| 스케일 | Phaser.Scale.FIT + CENTER_BOTH |
| 물리엔진 | Arcade Physics (gravity y: 800) |
| 프레임 | 60fps 목표 |

---

## ⛔️ DO NOT TOUCH

- `0.documents/0.instructions.txt` — 워크플로우 원본 (수정 금지)
- `0.documents/PRD.md` — 확정된 PRD (수정 시 인간 승인 필요)
- `.claude/` — Claude Code 설정 디렉토리
- `.git/` — Git 내부 디렉토리

---

## 마일스톤 상세 계획

### ☑️ M1: 프로젝트 셋업 + 카피바라 달리기 + 기본 조작

**목표**: 카피바라가 3레인에서 좌우 이동, 점프, 슬라이드하며 달리는 기본 프로토타입

#### M1-1. 프론트엔드 프로젝트 셋업

```
client/
├── src/
│   ├── main.ts
│   ├── scenes/
│   │   ├── Boot.ts
│   │   ├── Preloader.ts
│   │   ├── MainMenu.ts
│   │   ├── Game.ts
│   │   └── GameOver.ts
│   ├── objects/
│   │   └── Player.ts
│   └── utils/
│       └── Constants.ts
├── public/assets/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

**접근방식**:
- `npx degit phaserjs/template-vite-ts client`로 공식 템플릿 클론
- 불필요 파일 제거 후 Scene 구조 재편성
- `Constants.ts`에 게임 상수 집중 관리

**파일별 역할**:

| 파일 | 역할 |
|------|------|
| `main.ts` | Phaser.Game 인스턴스 생성, GameConfig 정의 |
| `Boot.ts` | 최소 에셋 로드 (로고 등) |
| `Preloader.ts` | 전체 에셋 로드 + 프로그레스바 |
| `MainMenu.ts` | 타이틀 화면, 시작 버튼, 모드 선택 |
| `Game.ts` | 게임 메인 루프 (러닝 코어) |
| `GameOver.ts` | 점수 표시, 재시작/메뉴 버튼 |
| `Player.ts` | 카피바라 캐릭터 클래스 |
| `Constants.ts` | LANE_COUNT, LANE_WIDTH, GAME_SPEED, GRAVITY 등 |

**코드 스니펫** (참고용):

```typescript
// Constants.ts
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;
export const LANE_COUNT = 3;
export const LANE_POSITIONS = [180, 360, 540]; // 좌, 중, 우
export const PLAYER_Y = 1000;
export const BASE_SPEED = 300;
export const MAX_SPEED = 800;
export const GRAVITY = 800;
export const JUMP_VELOCITY = -500;
export const SWIPE_THRESHOLD = 50;
```

```typescript
// Player.ts — 3레인 이동 + 점프 + 슬라이드
class Player extends Phaser.Physics.Arcade.Sprite {
    private currentLane: number = 1; // 0=좌, 1=중, 2=우

    moveLeft(): void {
        if (this.currentLane > 0) {
            this.currentLane--;
            // Tween으로 부드럽게 이동
        }
    }

    moveRight(): void {
        if (this.currentLane < LANE_COUNT - 1) {
            this.currentLane++;
        }
    }

    jump(): void {
        if (this.body?.touching.down) {
            this.setVelocityY(JUMP_VELOCITY);
        }
    }

    slide(): void {
        // 히트박스 축소 + 슬라이드 애니메이션
    }
}
```

#### M1-2. 입력 시스템

**터치 (모바일)**:
```typescript
// Game.ts — 스와이프 감지
private swipeStart: { x: number; y: number } | null = null;

create(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.swipeStart = { x: p.x, y: p.y };
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (!this.swipeStart) return;
        const dx = p.x - this.swipeStart.x;
        const dy = p.y - this.swipeStart.y;

        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
            dx > 0 ? this.player.moveRight() : this.player.moveLeft();
        } else if (Math.abs(dy) > SWIPE_THRESHOLD) {
            dy < 0 ? this.player.jump() : this.player.slide();
        }
        this.swipeStart = null;
    });
}
```

**키보드 (PC)**:
```typescript
// Game.ts — 키보드 바인딩
private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
}

update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.player.moveLeft();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.player.moveRight();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.player.jump();
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.player.slide();
}
```

#### M1-3. 배경 스크롤

**접근방식**: 패럴랙스 스크롤 (2~3레이어)
- 먼 배경 (구름/하늘): 느리게
- 중간 배경 (나무/산): 중간 속도
- 땅/레인: 게임 속도와 동일

```typescript
// Game.ts — TileSprite 기반 무한 스크롤
private bg1!: Phaser.GameObjects.TileSprite;
private bg2!: Phaser.GameObjects.TileSprite;
private ground!: Phaser.GameObjects.TileSprite;

update(): void {
    this.bg1.tilePositionX += this.gameSpeed * 0.2;
    this.bg2.tilePositionX += this.gameSpeed * 0.5;
    this.ground.tilePositionX += this.gameSpeed;
}
```

#### M1-4. 프로토타입 에셋

- 카피바라: 기본 도형 (갈색 원 + 사각형)으로 프로토타입
- 배경: 단색 그라디언트 + 심플 타일
- 후반에 실제 스프라이트로 교체

**트레이드오프**:
| 선택 | 장점 | 단점 |
|------|------|------|
| 도형 프로토타입 | 빠른 개발, 게임 로직 집중 | 시각적 피드백 약함 |
| AI 스프라이트 먼저 | 동기부여, 완성도 느낌 | 에셋 제작에 시간 소요 |
| → 도형 프로토타입 선택 | | |

---

### ☐ M2: 장애물 + 아이템 수집 + 충돌 + 점수 + Rust API

**목표**: 장애물 회피, 귤 수집, 점수 시스템, Rust 백엔드 API 연동

#### M2-1. 장애물 시스템

**추가 파일**:
```
client/src/
├── objects/
│   ├── Obstacle.ts          # 장애물 클래스
│   └── Item.ts              # 수집 아이템 클래스
├── pools/
│   ├── ObstaclePool.ts      # 장애물 오브젝트 풀
│   └── ItemPool.ts          # 아이템 오브젝트 풀
└── systems/
    ├── SpawnManager.ts       # 장애물/아이템 생성 관리
    └── DifficultyManager.ts  # 난이도 곡선 관리
```

**장애물 유형**:
| 유형 | 회피 방법 | 스프라이트 |
|------|----------|----------|
| 바위 | 좌우 이동 | 회색 사각형 |
| 나뭇가지 (높은) | 슬라이드 | 갈색 막대 (상단) |
| 물웅덩이 | 점프 | 파란 타원 |
| 뱀 | 점프 | 녹색 물결 (M3에서 추가) |

**오브젝트 풀링 패턴**:
```typescript
// ObstaclePool.ts
class ObstaclePool extends Phaser.Physics.Arcade.Group {
    constructor(scene: Phaser.Scene) {
        super(scene.physics.world, scene, {
            classType: Obstacle,
            maxSize: 10,
            runChildUpdate: true,
            active: false,
            visible: false
        });
    }

    spawn(lane: number, type: ObstacleType): Obstacle {
        const obstacle = this.getFirstDead(true) as Obstacle;
        if (obstacle) {
            obstacle.activate(lane, type);
        }
        return obstacle;
    }
}
```

#### M2-2. 난이도 곡선

```typescript
// DifficultyManager.ts
class DifficultyManager {
    private distance: number = 0;

    getSpeed(): number {
        // 선형 증가 + 캡
        return Math.min(BASE_SPEED + this.distance * 0.05, MAX_SPEED);
    }

    getSpawnInterval(): number {
        // 거리 증가 → 스폰 간격 감소
        return Math.max(2000 - this.distance * 0.5, 600); // ms
    }

    getObstaclePattern(): ObstaclePattern {
        // 난이도별 패턴 풀에서 선택
        if (this.distance < 500) return easyPatterns.random();
        if (this.distance < 2000) return mediumPatterns.random();
        return hardPatterns.random();
    }
}
```

**장애물 패턴 시스템**:
- 완전 랜덤 X → 사전 정의 패턴에서 랜덤 선택
- 패턴 = 레인별 장애물/아이템 배치 조합
- 반드시 1개 이상 빈 레인 보장 (회피 가능)

#### M2-3. 아이템 수집

| 아이템 | 점수 | 빈도 |
|--------|------|------|
| 귤 | +10 | 높음 |
| 수박 | +30 | 중간 |
| 온천 재료 (유황) | +50 | 낮음 |

```typescript
// 충돌 감지 — Game.ts
this.physics.add.overlap(
    this.player,
    this.itemPool,
    this.collectItem,
    undefined,
    this
);

private collectItem(player: Player, item: Item): void {
    item.deactivate(); // 풀에 반환
    this.score += item.points;
    this.items[item.type]++;
    // 게임 필: 바운스 + 반짝임 이펙트
}
```

#### M2-4. 점수 시스템 + 게임오버

```typescript
// Game.ts
private score: number = 0;
private distance: number = 0;

update(time: number, delta: number): void {
    this.distance += this.difficultyManager.getSpeed() * (delta / 1000);
    this.score = Math.floor(this.distance) + this.bonusScore;
}

private gameOver(): void {
    this.scene.start('GameOver', {
        score: this.score,
        distance: Math.floor(this.distance),
        items: this.items
    });
}
```

#### M2-5. 부활 시스템

```typescript
// Game.ts
private reviveCount: number = 0;
private maxRevives: number = 1; // 무료 부활 1회

private onHitObstacle(): void {
    if (this.reviveCount < this.maxRevives) {
        this.showRevivePrompt(); // "부활하시겠습니까?"
    } else {
        this.gameOver();
    }
}

private revive(): void {
    this.reviveCount++;
    this.player.setInvincible(2000); // 2초 무적
    // 향후: 광고 시청 후 추가 부활
}
```

#### M2-6. Rust 백엔드 셋업

**추가 파일**:
```
server/
├── src/
│   ├── main.rs
│   ├── config.rs
│   ├── db.rs
│   ├── error.rs
│   ├── routes/
│   │   ├── mod.rs
│   │   ├── scores.rs
│   │   └── users.rs
│   └── models/
│       ├── mod.rs
│       ├── score.rs
│       └── user.rs
├── migrations/
│   └── 001_init.sql
├── Cargo.toml
└── .env
```

**main.rs 구조**:
```rust
// 참고용 — 구현 아님
#[tokio::main]
async fn main() {
    let pool = SqlitePool::connect("sqlite:capybara.db?mode=rwc").await.unwrap();
    sqlx::migrate!().run(&pool).await.unwrap();

    let state = AppState { db: pool };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT])
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/scores", post(create_score))
        .route("/api/scores/top", get(top_scores))
        .route("/api/users", post(create_user))
        .route("/api/users/{id}", get(get_user))
        .route("/api/users/{id}/onsen", get(get_onsen).put(save_onsen))
        .layer(cors)
        .with_state(state);

    let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

**API 보안 — UUID 세션 토큰**:
```rust
// 유저 생성 시 UUID 토큰 발급
async fn create_user(State(state): State<AppState>) -> Json<UserResponse> {
    let id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    // DB에 id + token 저장
    // 클라이언트는 token을 localStorage에 저장
    // 이후 요청 시 Authorization: Bearer {token} 헤더로 인증
}
```

#### M2-7. 프론트 ↔ 백엔드 통신

```typescript
// ApiClient.ts
class ApiClient {
    private baseUrl: string = '/api';
    private token: string | null = null;

    constructor() {
        this.token = localStorage.getItem('capybara_token');
    }

    async createUser(nickname: string): Promise<User> {
        const res = await fetch(`${this.baseUrl}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname })
        });
        const data = await res.json();
        this.token = data.token;
        localStorage.setItem('capybara_token', data.token);
        localStorage.setItem('capybara_user_id', data.id);
        return data;
    }

    async saveScore(score: number, distance: number, items: number): Promise<void> {
        await fetch(`${this.baseUrl}/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ score, distance, items_collected: items })
        });
    }
}
```

**localStorage + 서버 동기화 전략**:
```
1. 첫 방문 → 닉네임 입력 → POST /api/users → token + id 발급
2. localStorage에 token, user_id, 온천 데이터 저장
3. 게임오버 시 → POST /api/scores (서버에 점수 전송)
4. 온천 꾸미기 변경 시 → localStorage 즉시 저장 + 서버 비동기 동기화
5. 재방문 시 → localStorage 확인 → 있으면 서버 데이터 동기화
```

**트레이드오프**:
| 선택 | 장점 | 단점 |
|------|------|------|
| localStorage only | 서버 없이 동작 | 브라우저 변경 시 데이터 유실 |
| 서버 only | 데이터 영구 보관 | 네트워크 필수, 오프라인 불가 |
| → localStorage + 서버 동기화 | 오프라인 지원 + 영구 보관 | 동기화 충돌 가능 (last-write-wins) |

---

### ☐ M3: 파워업 + 스테이지 배경 전환

**목표**: 3종 파워업, 4개 스테이지 배경, 게임 필 이펙트

#### M3-1. 파워업 시스템

**추가 파일**:
```
client/src/objects/PowerUp.ts
client/src/pools/PowerUpPool.ts
```

| 파워업 | 효과 | 지속시간 | 시각 이펙트 |
|--------|------|---------|------------|
| 수박 헬멧 | 장애물 1회 방어 | 1회 소모 | 수박 모자 오버레이 |
| 오리 튜브 | 물 구간 이동 + 코인 2배 | 5초 | 오리 튜브 착용 |
| 친구 동물 합류 | 무적 + 자동 수집 | 8초 | 동물 친구가 옆에서 달림 |

```typescript
// Player.ts — 파워업 적용
applyPowerUp(type: PowerUpType): void {
    switch (type) {
        case 'helmet':
            this.hasHelmet = true;
            this.showHelmetSprite();
            break;
        case 'tube':
            this.isOnTube = true;
            this.scene.time.delayedCall(5000, () => this.isOnTube = false);
            break;
        case 'friend':
            this.isInvincible = true;
            this.autoCollect = true;
            this.spawnFriendAnimal();
            this.scene.time.delayedCall(8000, () => {
                this.isInvincible = false;
                this.autoCollect = false;
            });
            break;
    }
}
```

#### M3-2. 스테이지 배경 전환

```
거리 0~500:    숲속 (초록, 나무)
거리 500~1500: 강가 (파랑, 물, 다리)
거리 1500~3000: 마을 (갈색, 집, 길)
거리 3000+:    온천 (보라/분홍, 온천, 수증기)
→ 온천 이후 숲속으로 루프 (난이도 유지)
```

```typescript
// Game.ts — 스테이지 전환
private checkStageTransition(): void {
    const stage = this.getStageByDistance(this.distance);
    if (stage !== this.currentStage) {
        this.currentStage = stage;
        this.transitionBackground(stage);
        this.updateObstacleTheme(stage);
        // 전환 이펙트: 페이드 또는 스크롤
    }
}
```

#### M3-3. 게임 필 이펙트

| 이벤트 | 이펙트 |
|--------|--------|
| 아이템 수집 | 반짝임 파티클 + 작은 바운스 + 카운터 팝업 (+10) |
| 장애물 충돌 | 화면 살짝 붉어짐 (200ms) + 카메라 약한 흔들림 |
| 파워업 획득 | 전신 반짝 + 사운드 + 슬로우모션 (0.5초) |
| 스테이지 전환 | 화면 페이드 + "강가에 도착!" 텍스트 |
| 부활 | 무적 반짝임 (깜빡) |

---

### ☐ M4: 온천 꾸미기 + 캐릭터 스킨 + 유저 데이터

**목표**: 온천 꾸미기 메타게임, 캐릭터 스킨, 서버 데이터 관리

#### M4-1. 온천 꾸미기 Scene

**추가 파일**:
```
client/src/scenes/Onsen.ts
client/src/objects/OnsenItem.ts
```

```typescript
// Onsen.ts — 꾸미기 화면
class Onsen extends Phaser.Scene {
    private onsenData: OnsenData;
    private placedItems: OnsenItem[] = [];

    create(data: { inventory: Inventory }): void {
        // 온천 배경 표시
        // 인벤토리 UI (보유 아이템)
        // 드래그 앤 드롭으로 아이템 배치
        // 저장 버튼 → localStorage + 서버 동기화
    }
}

interface OnsenData {
    type: 'basic' | 'forest' | 'snow' | 'luxury';
    items: Array<{ id: string; x: number; y: number }>;
    friends: string[]; // 배치된 동물 친구 ID
}
```

#### M4-2. 캐릭터 스킨

```typescript
// 스킨 잠금해제 조건
const SKINS: SkinConfig[] = [
    { id: 'default', name: '기본 카피바라', unlockCondition: 'always' },
    { id: 'towel', name: '수건 카피바라', unlockCondition: 'distance_5000' },
    { id: 'yukata', name: '유카타 카피바라', unlockCondition: 'onsen_level_3' },
    { id: 'santa', name: '산타 카피바라', unlockCondition: 'items_1000' },
];
```

---

### ☐ M5: 사운드/UI + Nginx 배포 + 리더보드

**목표**: 폴리싱, 배포, 리더보드

#### M5-1. 사운드

| 종류 | 파일 | 출처 |
|------|------|------|
| BGM (숲속) | forest.mp3 | 무료 에셋 |
| BGM (온천) | onsen.mp3 | 무료 에셋 |
| 귤 수집 | collect.wav | 자체 제작 |
| 점프 | jump.wav | 자체 제작 |
| 충돌 | hit.wav | 자체 제작 |
| 파워업 | powerup.wav | 자체 제작 |

#### M5-2. UI 다듬기

```
게임 중 HUD:
┌─────────────────────────┐
│  🍊 42    ⭐ 1,280      │  ← 상단: 아이템 수, 점수
│                         │
│                         │
│                         │  ← 게임 영역
│                         │
│  ❚❚ 일시정지             │  ← 하단: 일시정지 버튼
└─────────────────────────┘
```

#### M5-3. 튜토리얼 / 온보딩

```
첫 플레이 시:
1. "← → 스와이프로 이동해보세요" (좌우 화살표 표시)
2. "↑ 스와이프로 점프!" (위 화살표 + 장애물 등장)
3. "↓ 스와이프로 슬라이드!" (아래 화살표 + 높은 장애물)
4. "귤을 수집하세요!" (귤 강조 표시)
→ 4단계 완료 후 자동으로 본 게임 시작
```

#### M5-4. 릴렉스 모드

```typescript
// Game.ts — 모드별 설정
interface GameMode {
    speedMultiplier: number;
    spawnRateMultiplier: number;
    bgm: string;
    hasObstacles: boolean;
}

const MODES: Record<string, GameMode> = {
    normal: {
        speedMultiplier: 1.0,
        spawnRateMultiplier: 1.0,
        bgm: 'bgm_normal',
        hasObstacles: true
    },
    relax: {
        speedMultiplier: 0.5,
        spawnRateMultiplier: 0.3,
        bgm: 'bgm_relax', // 물소리, 자연 ASMR
        hasObstacles: true // 있지만 매우 적음
    }
};
```

#### M5-5. Nginx 배포

```nginx
# /etc/nginx/sites-available/capybara
server {
    listen 80;
    server_name _;

    # 정적 파일 (Phaser 게임)
    root /home/cc2/game01/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # API 리버스 프록시
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # gzip 압축
    gzip on;
    gzip_types text/plain application/javascript text/css application/json;
}
```

**배포 스크립트**:
```bash
#!/bin/bash
# deploy.sh
cd /home/cc2/game01/client && npm run build
cd /home/cc2/game01/server && cargo build --release
# Axum 서버 재시작 (systemd 서비스)
sudo systemctl restart capybara-api
```

#### M5-6. 리더보드

```typescript
// Leaderboard 컴포넌트 — GameOver.ts에 통합
private async showLeaderboard(): Promise<void> {
    const scores = await this.apiClient.getTopScores(10);
    // 상위 10명 점수 표시
    // 본인 순위 하이라이트
}
```

---

## 데이터 흐름 요약

```
[브라우저]
  ├── localStorage (임시)
  │   ├── capybara_token
  │   ├── capybara_user_id
  │   └── capybara_onsen_data
  │
  └── fetch API ──→ [Nginx :80] ──→ [Axum :3000]
                                        └── SQLite
                                            ├── users
                                            ├── scores
                                            └── onsen
```

---

## 전체 파일 맵

```
game01/
├── 0.documents/
│   ├── 0.instructions.txt
│   ├── PRD.md
│   ├── SUMMARY-STEP0.md
│   ├── research.md
│   └── plan.md              ← 현재 문서
├── client/                    ← M1에서 생성
│   ├── src/
│   │   ├── main.ts
│   │   ├── scenes/
│   │   │   ├── Boot.ts
│   │   │   ├── Preloader.ts
│   │   │   ├── MainMenu.ts
│   │   │   ├── Game.ts
│   │   │   ├── GameOver.ts
│   │   │   └── Onsen.ts      ← M4
│   │   ├── objects/
│   │   │   ├── Player.ts
│   │   │   ├── Obstacle.ts    ← M2
│   │   │   ├── Item.ts        ← M2
│   │   │   ├── PowerUp.ts     ← M3
│   │   │   └── OnsenItem.ts   ← M4
│   │   ├── pools/
│   │   │   ├── ObstaclePool.ts ← M2
│   │   │   ├── ItemPool.ts     ← M2
│   │   │   └── PowerUpPool.ts  ← M3
│   │   ├── systems/
│   │   │   ├── SpawnManager.ts      ← M2
│   │   │   └── DifficultyManager.ts ← M2
│   │   └── utils/
│   │       ├── ApiClient.ts    ← M2
│   │       └── Constants.ts
│   ├── public/assets/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                    ← M2에서 생성
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs
│   │   ├── db.rs
│   │   ├── error.rs
│   │   ├── routes/
│   │   │   ├── mod.rs
│   │   │   ├── scores.rs
│   │   │   └── users.rs
│   │   └── models/
│   │       ├── mod.rs
│   │       ├── score.rs
│   │       └── user.rs
│   ├── migrations/
│   │   └── 001_init.sql
│   ├── Cargo.toml
│   └── .env
├── deploy.sh                  ← M5
├── README.md
└── .gitignore
```
