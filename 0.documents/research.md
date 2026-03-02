# STEP 1. 코드리서치 — research.md

> 아직 구현하지 않음. 리서치만 진행.

## 1. 현재 프로젝트 상태

```
game01/
├── .claude/hooks/notify.sh    # 작업 완료 알림 Hook
├── .git/                      # Git 초기화 완료
├── .gitignore
├── 0.documents/
│   ├── 0.instructions.txt     # 개발 워크플로우 원본
│   ├── PRD.md                 # 제품 요구사항 문서
│   └── SUMMARY-STEP0.md       # STEP 0 요약
└── README.md                  # 프로젝트 소개
```

- 코드 없음. 빈 프로젝트에서 시작
- 기존 패턴/데이터 흐름 없음 → 아키텍처 설계부터 필요

## 2. 프론트엔드 리서치 (Phaser 3 + TypeScript + Vite)

### 2-1. 프로젝트 템플릿

공식 템플릿 사용: [phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts)

```bash
npx degit phaserjs/template-vite-ts client
```

핵심 구조:
```
client/
├── src/
│   ├── main.ts              # 게임 설정 (Phaser.Game)
│   ├── scenes/
│   │   ├── Boot.ts           # 최소 에셋 로드
│   │   ├── Preloader.ts      # 전체 에셋 로드 + 프로그레스바
│   │   ├── MainMenu.ts       # 타이틀 화면
│   │   ├── Game.ts           # 게임 플레이 (러닝 코어)
│   │   ├── GameOver.ts       # 게임 오버 + 점수
│   │   └── Onsen.ts          # 온천 꾸미기 화면
│   ├── objects/
│   │   ├── Player.ts         # 카피바라 캐릭터
│   │   ├── Obstacle.ts       # 장애물
│   │   ├── Item.ts           # 수집 아이템 (귤, 과일)
│   │   └── PowerUp.ts        # 파워업 아이템
│   ├── pools/
│   │   ├── ObstaclePool.ts   # 장애물 오브젝트 풀
│   │   └── ItemPool.ts       # 아이템 오브젝트 풀
│   └── utils/
│       ├── ApiClient.ts      # 백엔드 API 통신
│       └── Constants.ts      # 게임 상수
├── public/
│   └── assets/               # 스프라이트, 사운드
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 2-2. 게임 설정 패턴

```typescript
// Phaser.Game 설정 (참고용 — 구현 아님)
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 720,          // 모바일 세로 기준
    height: 1280,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 800 },
            debug: false
        }
    },
    scene: [Boot, Preloader, MainMenu, Game, GameOver, Onsen]
};
```

### 2-3. 무한러너 핵심 패턴 — 오브젝트 풀링

Phaser 3의 `Group`을 활용한 오브젝트 풀링:
- 장애물/아이템을 미리 생성 후 재활용
- `setActive(false)` / `setVisible(false)` 로 비활성화
- 화면 밖으로 나간 오브젝트를 풀에 반환
- 메모리 할당/해제 없이 60fps 유지

```
[활성 그룹] ←→ [비활성 풀]
    ↓ 화면 밖 이동     ↑ 새 장애물 필요
    └─────────────────┘
```

### 2-4. 3레인 시스템

```
┌─────────────────────┐
│  [좌]  [중앙]  [우]  │  ← 3개 레인
│                     │
│   🌊   🍊    🪨    │  ← 장애물/아이템 배치
│                     │
│        🦫           │  ← 카피바라 (레인 이동)
└─────────────────────┘
```

- 좌/우 스와이프 → 레인 이동 (Tween 애니메이션)
- 위 스와이프 → 점프
- 아래 스와이프 → 슬라이드

### 2-5. 입력 처리

```
모바일 터치:
- Pointer Down + Move → 방향 감지 (swipe)
- 최소 이동 거리 threshold 설정 (오작동 방지)

PC 키보드:
- ←/→ 또는 A/D → 레인 이동
- ↑ 또는 Space → 점프
- ↓ → 슬라이드
```

### 2-6. Scene 흐름

```
Boot → Preloader → MainMenu
                      ↓
                    Game ←→ GameOver
                      ↓
                    Onsen (온천 꾸미기)
```

## 3. 백엔드 리서치 (Rust + Axum + sqlx + SQLite)

### 3-1. 프로젝트 구조

```
server/
├── src/
│   ├── main.rs           # 서버 시작, 라우터 조립
│   ├── config.rs         # 환경변수, DB 경로
│   ├── routes/
│   │   ├── mod.rs
│   │   ├── scores.rs     # 점수 API
│   │   └── users.rs      # 유저 API
│   ├── models/
│   │   ├── mod.rs
│   │   ├── score.rs      # Score 구조체
│   │   └── user.rs       # User 구조체
│   └── db.rs             # DB 풀 초기화, 마이그레이션
├── migrations/
│   └── 001_init.sql      # 테이블 생성
├── Cargo.toml
└── .env
```

### 3-2. 핵심 의존성 (Cargo.toml)

```toml
[dependencies]
axum = "0.8"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
tower-http = { version = "0.6", features = ["cors", "fs"] }
uuid = { version = "1", features = ["v4"] }
```

### 3-3. AppState 패턴

```rust
// 참고용 — 구현 아님
struct AppState {
    db: sqlx::SqlitePool,
}

// Router에 상태 공유
let state = Arc::new(AppState { db: pool });
let app = Router::new()
    .route("/api/scores", post(create_score).get(top_scores))
    .with_state(state);
```

### 3-4. API 엔드포인트 설계

| Method | Path | 설명 |
|--------|------|------|
| POST | /api/scores | 점수 저장 |
| GET | /api/scores/top | 리더보드 (상위 N개) |
| POST | /api/users | 게스트 유저 생성 |
| GET | /api/users/:id | 유저 정보 조회 |
| GET | /api/users/:id/onsen | 온천 데이터 조회 |
| PUT | /api/users/:id/onsen | 온천 데이터 저장 |

### 3-5. DB 스키마 (SQLite)

```sql
-- users 테이블
CREATE TABLE users (
    id TEXT PRIMARY KEY,          -- UUID
    nickname TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- scores 테이블
CREATE TABLE scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    score INTEGER NOT NULL,
    distance INTEGER NOT NULL,
    items_collected INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- onsen 테이블 (온천 꾸미기 데이터)
CREATE TABLE onsen (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    data TEXT NOT NULL,           -- JSON 형태 저장
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 4. 배포 아키텍처

```
[브라우저] → [Nginx :80/:443]
                ├── /          → 정적 파일 (client/dist/)
                └── /api/*     → 리버스 프록시 → [Axum :3000]
                                                    └── SQLite DB
```

### Nginx 설정 핵심

```nginx
server {
    listen 80;
    root /home/cc2/game01/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA 라우팅
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;   # Axum 서버
        proxy_set_header Host $host;
    }
}
```

## 5. 외부 의존성 정리

### 프론트엔드 (npm)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| phaser | 3.90.0 | 게임 엔진 |
| typescript | 5.9.x | 타입 안전성 |
| vite | 7.x | 번들러 + HMR |

### 백엔드 (cargo)

| 크레이트 | 버전 | 용도 |
|----------|------|------|
| axum | 0.8.x | 웹 프레임워크 |
| tokio | 1.x | 비동기 런타임 |
| sqlx | 0.8.x | SQLite 비동기 드라이버 |
| serde / serde_json | 1.x | JSON 직렬화 |
| tower-http | 0.6.x | CORS, 정적 파일 서빙 |
| uuid | 1.x | 유저 ID 생성 |

## 6. 기존 패턴 / 컨벤션

- 아직 코드 없음 → 아래 컨벤션 채택 예정:
  - TypeScript: strict mode, no any/unknown
  - Rust: clippy 경고 0, rustfmt 적용
  - 파일명: kebab-case (프론트), snake_case (Rust)
  - 커밋: 한글 + conventional commits (feat/fix/docs/refactor)

## 7. 리스크 & 주의사항

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 에셋 부족 | 개발 속도 저하 | 기본 도형으로 프로토타입 → 후반에 에셋 교체 |
| 모바일 성능 | 저사양 기기 렉 | 오브젝트 풀링 + 텍스처 아틀라스 사용 |
| Rust 학습 곡선 | 백엔드 개발 지연 | Axum 공식 예제 기반 단순 CRUD로 시작 |
| SQLite 동시성 | 다수 유저 시 병목 | WAL 모드 활성화, 향후 PostgreSQL 전환 가능 |
