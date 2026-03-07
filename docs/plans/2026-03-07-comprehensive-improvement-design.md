# 종합 개선 설계서 v3.0

**날짜**: 2026-03-07
**기준**: 6차원 병렬 분석 (아키텍처/게임플레이/성능/수익화/차별화/프로덕션)
**현재 등급**: A- | **목표 등급**: A+
**현재 상태**: tsc 0 errors, 330 vitest, 28 cargo tests

---

## 분석 요약

| 차원 | 점수 | 핵심 이슈 |
|------|------|-----------|
| 코드 아키텍처 | B+ | God Object, 미테스트 시스템, 비null 단언 |
| 게임플레이/UX | A- | 스폰 벽, 파워업 무음, 콤보 타이머 부재 |
| 성능/최적화 | A+ | 이슈 없음 (프로덕션급) |
| 수익화/비즈니스 | D | 젬 소스 0, 결제 없음, 서버 검증 누락 |
| 차별화/경쟁력 | B | ASMR 릴랙스 전용, 소셜 0, 동물친구 부재 |
| 프로덕션 준비도 | A- | 보안 우수, 법적 문서 없음, 접근성 미구현 |

---

## TIER 0 — CRITICAL (즉시 수정, ~150줄)

### C1. Shop.ts gem 소비 서버 검증 추가
**문제**: `Shop.purchase()`가 `InventoryManager.spendGems()`만 호출 — localStorage만 차감, 서버 미호출
**공격벡터**: `localStorage.setItem('capybara_gem', '99999')` → 무제한 구매
**수정 파일**: `client/src/scenes/Shop.ts`
**변경 내용**:
```typescript
// BEFORE (Shop.ts → purchase())
private purchase(item: ShopItem): void {
    if (!this.inventoryMgr.spendGems(item.gemCost)) return;
    // ... unlock logic
}

// AFTER
private async purchase(item: ShopItem): Promise<void> {
    // 1. 서버에 gem 소비 요청 (원자적 검증)
    const api = ApiClient.getInstance();
    const success = await api.spendInventory('gem', item.gemCost);
    if (!success) {
        // 서버 거부 → 로컬 동기화
        this.showMessage('젬이 부족합니다');
        return;
    }
    // 2. 로컬 차감 (서버 성공 후)
    this.inventoryMgr.spendGems(item.gemCost);
    // 3. 아이템 지급
    // ... unlock logic (기존 코드 유지)
}
```
**테스트**: 기존 서버 `POST /api/inventory/spend` 엔드포인트 활용 (integration_test.rs에 3건 존재)

### C2. TextureAtlasBuilder 프레임 존재 검증
**문제**: `.find()!` 비null 단언 7개 — 새 ObstacleType 추가 시 프레임 누락하면 런타임 크래시
**수정 파일**: `client/src/utils/TextureAtlasBuilder.ts`
**변경 내용**:
```typescript
// BEFORE (7곳)
const frame = frames.find(f => f.key === `obstacle-${type}`)!;

// AFTER (유틸 함수 추가)
function getFrame(frames: FrameInfo[], key: string): FrameInfo {
    const frame = frames.find(f => f.key === key);
    if (!frame) {
        console.error(`[TextureAtlas] Missing frame: ${key}`);
        // 폴백: 첫 번째 프레임 사용 (크래시 방지)
        return frames[0];
    }
    return frame;
}

// 사용: const frame = getFrame(frames, `obstacle-${type}`);
```
**영향 범위**: buildGameAtlas() 내 7개 `.find()!` → `getFrame()` 교체

### C3. Game.ts 에러 핸들러 ErrorTracker 연동
**문제**: 13개 시스템 update() try-catch가 `console.error`만 — 사용자에게 진행 멈춤 표시 없음
**수정 파일**: `client/src/scenes/Game.ts`
**변경 내용**:
```typescript
// BEFORE (13곳 패턴)
try { this.stageManager.update(this.distance); }
catch (e) { console.error('[StageManager]', e); }

// AFTER (헬퍼 메서드)
private systemErrors = 0;

private safeUpdate(name: string, fn: () => void): void {
    try {
        fn();
    } catch (e) {
        console.error(`[${name}]`, e);
        ErrorTracker.getInstance().capture(e instanceof Error ? e : new Error(String(e)));
        this.systemErrors++;
        // 연속 3회 에러 → 게임 일시정지 + 에러 표시
        if (this.systemErrors >= 3) {
            this.state = 'paused';
            this.showSystemError();
        }
    }
}

// 사용:
this.safeUpdate('StageManager', () => this.stageManager.update(this.distance));
this.safeUpdate('WeatherSystem', () => this.weatherSystem?.update(dt));
// ... 13곳 모두 교체
```
**추가**: `showSystemError()` — "일시적 오류 발생. 재시작합니다" 메시지 + 3초 후 MainMenu 복귀

### C4. 8000m+ 스폰 벽 완화
**문제**: extreme 난이도에서 500ms 간격 × 2개 장애물 → 회피 불가 상황
**수정 파일**: `client/src/utils/Constants.ts`, `client/src/systems/DifficultyManager.ts`
**변경 내용**:
```typescript
// Constants.ts
// BEFORE
export const MIN_SPAWN_INTERVAL = 500;

// AFTER
export const MIN_SPAWN_INTERVAL = 600;           // 500→600ms
export const EXTREME_MAX_OBSTACLES_PER_SPAWN = 1; // 2→1 (extreme에서)

// DifficultyManager.ts — getSpawnInterval()
// extreme 구간에서 최대 장애물 수를 1로 제한
if (difficulty === 'extreme') {
    return { interval: Math.max(interval, MIN_SPAWN_INTERVAL), maxObstacles: 1 };
}
```
**테스트**: DifficultyManager.test.ts에 extreme 구간 테스트 추가

---

## TIER 1 — HIGH 우선순위 (1주 내, ~300줄)

### H1. 파워업 수집 SFX 추가
**파일**: `client/src/services/SoundManager.ts`, `client/src/scenes/Game.ts`
**설계**:
- SoundManager에 `powerup` SFX 생성 (100ms FM 합성 상승 치프)
- Game.ts `onCollectPowerUp()`에 `sound.playSfx('powerup')` 추가
- 주파수: 800Hz → 1200Hz 슬라이드 (50ms), gain 0.3
```typescript
// SoundManager.ts — createPowerupSfx()
private createPowerupSfx(): void {
    // 상승 치프 (800→1200Hz, 100ms)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
    // ... gain envelope
}
```

### H2. 콤보 타이머 시각화
**파일**: `client/src/ui/GameHUD.ts`
**설계**:
- 콤보 텍스트 아래 타이머 바 (Graphics 객체)
- 2초 → 0초 선형 감소, 색상 변화 (초록→노랑→빨강)
- ComboManager.getTimeRemaining() 메서드 추가
```
[COMBO x3]
[███████░░░] ← 타이머 바 (70% 남음, 노랑)
```

### H3. 일반 모드 저볼륨 ASMR 앰비언트
**파일**: `client/src/scenes/Game.ts`, `client/src/services/SoundManager.ts`
**설계**:
- 일반 모드에서도 스테이지별 앰비언트 재생
- 볼륨: 릴랙스 0.35 → 일반 0.12 (배경 수준)
- 장애물 근접 시 자동 duck (0.05로 감소)
```typescript
// Game.ts — stageChanged callback
if (this.mode !== 'relax') {
    sound.playAmbient(weatherAmbient, 0.12); // 저볼륨
}
```

### H4. SpawnManager + StageManager 테스트 추가
**파일**: `client/src/__tests__/SpawnManager.test.ts` (신규), `client/src/__tests__/StageManager.test.ts` (신규)
**범위**:
- SpawnManager: 스폰 확률, 난이도별 간격, 장애물 타입 배분 (15케이스)
- StageManager: 스테이지 전환, BGM 변경, 난이도 임계값 (10케이스)
- 예상: +25 vitest 케이스 (330→355)

### H5. ApiClient 재인증 레이스 컨디션 수정
**파일**: `client/src/services/ApiClient.ts`
**설계**:
```typescript
// BEFORE: isReAuthenticating boolean 플래그
// AFTER: Promise 기반 deduplication
private reAuthPromise: Promise<void> | null = null;

private async handleAuthError(): Promise<void> {
    if (this.reAuthPromise) return this.reAuthPromise;
    this.reAuthPromise = this.doReAuth();
    try { await this.reAuthPromise; }
    finally { this.reAuthPromise = null; }
}
```

### H6. MainMenu 미션 알림 배지
**파일**: `client/src/scenes/MainMenu.ts`
**설계**:
- 미션 버튼 우상단에 빨간 원형 뱃지 ("!")
- InventoryManager에서 오늘 미션 완료 여부 확인
- 미완료 미션 있으면 뱃지 표시
```
[미션 🔴] [다이어리]
```

---

## TIER 2 — MEDIUM 우선순위 (2주 내, ~500줄)

### M1. 개인정보처리방침 + 이용약관
**파일**: `client/public/privacy.html`, `client/public/terms.html`
**내용**:
- 수집 데이터: UUID 토큰, 점수, 인벤토리, 게임 이벤트
- 보관 기간: 서비스 운영 기간
- 삭제 요청: 이메일 연락처
- MainMenu 하단에 링크 추가

### M2. 젬 무료 획득 경로
**파일**: `client/src/scenes/Missions.ts`, `server/src/routes/missions.rs`
**설계**:
- 7일 연속 로그인 보상: Day7 = 10 gem (streak 보상에 추가)
- 마일스톤 보상: 첫 5000m = 5 gem, 첫 10000m = 15 gem
- 퀘스트 완료 보상에 gem 옵션 추가 (기존 mandarin 외)

### M3. 다이어리 10km+ 콘텐츠 확장
**파일**: `client/src/utils/DiaryData.ts`
**설계**:
- Entry 11~15 추가 (15km, 20km, 30km, 50km, 100km)
- 테마: "전설의 온천", "눈산 너머", "카피바라 왕국"
- 마일스톤 보상 연동 (gem + 특별 칭호)

### M4. 동물친구 게임 내 시각적 동반
**파일**: `client/src/objects/Player.ts`, `client/src/scenes/Game.ts`
**설계**:
- Player 옆 작은 동물 스프라이트 (32x32)
- 플레이어 이동 시 0.3초 지연 추적 (lerp)
- 점프 시 함께 점프 (약간 높이 차이)
- TextureAtlasBuilder에 companion 소형 프레임 추가

### M5. 날씨 시스템 게임플레이 영향 (토글)
**파일**: `client/src/systems/WeatherSystem.ts`, `client/src/utils/Constants.ts`
**설계** (선택적 토글 — 기본 OFF):
- 비: 슬라이드 거리 20% 증가 (미끄러움)
- 눈: 이동 속도 10% 감소
- 꽃잎: 효과 없음 (순수 비주얼)
- 증기: 시야 약간 흐림 (투명도 0.15 오버레이)
- Constants에 `WEATHER_GAMEPLAY_EFFECTS: boolean = false` 추가

### M6. 오프사이트 백업
**파일**: `deploy/backup-db.sh`
**설계**:
- 로컬 백업 후 rsync 또는 rclone으로 원격 저장소 동기화
- 보관: 30일 (로컬 7.5일 + 원격 30일)
- integrity_check 추가

### M7. 릴랙스 모드 전용 리더보드/보상
**파일**: `client/src/scenes/GameOver.ts`, `server/src/routes/scores.rs`
**설계**:
- 서버: scores 테이블에 `mode` 컬럼 추가 (migration 009)
- 클라이언트: GameOver에서 모드별 리더보드 탭
- 릴랙스 전용 보상: "평화로운 달리기" 칭호, 릴랙스 전용 스킨

---

## TIER 3 — LOW 우선순위 (이후)

### L1. 소셜 기능
- 글로벌 리더보드 (일간/주간/전체)
- 고스트 레이싱 (비동기 멀티플레이어)
- 온천/동물친구 카드 SNS 공유

### L2. 결제 SDK (Stripe)
- 젬 패키지: 100(₩5,500), 550(₩27,500), 1200(₩55,000)
- 서버 webhook 검증
- 구매 이력 API

### L3. 접근성
- ARIA 라벨 (UIFactory 버튼)
- 색맹 모드 (대체 팔레트)
- prefers-reduced-motion 지원

### L4. i18n 다국어
- JSON 번역 파일 구조
- 영어/일본어 지원 (카피바라 인기 시장)

### L5. 시즌 배틀패스
- 무료 티어 (3 gem 보상 across 50레벨)
- 프리미엄 티어 (100+ gem + 한정 코스메틱)
- 6주 시즌 주기

### L6. 세션 분석
- DAU/WAU/MAU 추적
- 퍼널: 시작→첫 점수→첫 미션→첫 구매
- 리텐션 D1/D7/D30 분석

---

## 실행 순서 (권장)

```
Week 1: TIER 0 (C1~C4) — 보안/안정성 CRITICAL
        ↓ 테스트 통과 확인 + 커밋
Week 2: TIER 1 (H1~H6) — UX/차별화 HIGH
        ↓ 테스트 통과 확인 + 커밋
Week 3: TIER 2 전반 (M1~M3) — 법적/수익화
Week 4: TIER 2 후반 (M4~M7) — 차별화/인프라
        ↓ 종합 테스트 + 배포
Month 2+: TIER 3 (L1~L6) — 스케일링/확장
```

## 검증 기준

| 단계 | 검증 항목 |
|------|-----------|
| TIER 0 완료 | tsc 0, vitest 335+, cargo 28+, Shop 서버 호출 확인 |
| TIER 1 완료 | vitest 355+, 파워업 SFX 재생, 콤보 타이머 표시, 앰비언트 일반모드 |
| TIER 2 완료 | vitest 370+, 법적 문서 배포, 젬 획득 경로 작동, 다이어리 15엔트리 |
| 전체 완료 | 등급 A+, 사용자 테스트 피드백 반영 |

---

## 파일 변경 영향 매트릭스

| 파일 | C1 | C2 | C3 | C4 | H1 | H2 | H3 | H4 | H5 | H6 |
|------|----|----|----|----|----|----|----|----|----|----|
| Shop.ts | ✏️ | | | | | | | | | |
| TextureAtlasBuilder.ts | | ✏️ | | | | | | | | |
| Game.ts | | | ✏️ | | | | ✏️ | | | |
| Constants.ts | | | | ✏️ | | | | | | |
| DifficultyManager.ts | | | | ✏️ | | | | | | |
| SoundManager.ts | | | | | ✏️ | | ✏️ | | | |
| GameHUD.ts | | | | | | ✏️ | | | | |
| ComboManager.ts | | | | | | ✏️ | | | | |
| ApiClient.ts | | | | | | | | | ✏️ | |
| MainMenu.ts | | | | | | | | | | ✏️ |
| SpawnManager.test.ts | | | | | | | | 🆕 | | |
| StageManager.test.ts | | | | | | | | 🆕 | | |

✏️ = 수정, 🆕 = 신규 생성

---

*이 문서는 6차원 병렬 분석(아키텍처/게임플레이/성능/수익화/차별화/프로덕션) 결과를 기반으로 작성되었습니다.*
*분석 에이전트: Opus 4.6 메인 + Explore 서브에이전트 6개 병렬*
