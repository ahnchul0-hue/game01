// ============================================================
// Game.ts — 게임 메인 루프 Scene
// ============================================================
// 핵심 게임플레이가 이루어지는 Scene.
// 카피바라가 달리고, 장애물을 피하고, 아이템을 수집한다.
//
// [Scene 데이터 수신]
// - init(data): MainMenu에서 전달받은 데이터
//   - data.mode: 'normal' | 'relax' → 게임 모드 설정
//
// ============================================================
// [멤버 변수]
// ============================================================
// - player: Player — 카피바라 캐릭터 인스턴스
// - gameSpeed: number — 현재 게임 속도 (배경 스크롤 + 장애물 이동)
// - distance: number — 누적 이동 거리 (점수 계산 기준)
// - score: number — 현재 점수
// - isGameOver: boolean — 게임 종료 플래그
// - mode: 'normal' | 'relax' — 게임 모드
//
// - bg1, bg2, ground: TileSprite — 패럴랙스 배경 3레이어
//
// - cursors: CursorKeys — 키보드 입력 (PC)
// - swipeStart: {x, y} | null — 스와이프 시작점 (모바일)
//
// - scoreText: Text — HUD 점수 표시
// - distanceText: Text — HUD 거리 표시
//
// ============================================================
// [create — 초기화]
// ============================================================
//
// 1. 모드 설정
//    - init()에서 받은 mode에 따라 속도 배율, 스폰율 조정
//    - relax 모드: 속도 0.5배, 장애물 스폰 0.3배
//
// 2. 배경 생성 (패럴랙스 3레이어)
//    - bg1 = TileSprite (하늘/구름) — 전체 화면 크기
//    - bg2 = TileSprite (나무/산) — 전체 화면 크기
//    - ground = TileSprite (땅/레인) — 하단 배치
//    → 프로토타입: 단색 사각형으로 대체
//
// 3. 레인 시각화
//    - 3개 레인 구분선 표시 (얇은 흰색 선 또는 점선)
//    - Graphics 객체로 세로선 2개 그리기
//    → 프로토타입에서만 표시, 에셋 적용 시 제거
//
// 4. 플레이어 생성
//    - new Player(this, LANE_POSITIONS[1], PLAYER_Y)
//    - 중앙 레인에서 시작
//    - 물리 바디 설정: setCollideWorldBounds(true) 안 씀
//    - 바닥 충돌은 수동 관리 (Y 좌표 제한)
//
// 5. 입력 설정
//    a) 키보드 (PC)
//       - createCursorKeys() → 화살표 키
//       - JustDown으로 한 번만 인식 (update에서 체크)
//
//    b) 터치 (모바일)
//       - 'pointerdown': swipeStart 기록
//       - 'pointerup': swipeEnd 계산
//       - dx, dy 비교 → 방향 결정
//       - |delta| < SWIPE_THRESHOLD → 무시
//       - |dx| > |dy| → 좌/우 이동
//       - |dy| > |dx| → dy < 0이면 점프, dy > 0이면 슬라이드
//
// 6. HUD (Head-Up Display) 생성
//    - 좌상단: 점수 텍스트 ("⭐ 0")
//    - 우상단: 거리 텍스트 ("0m")
//    - setScrollFactor(0)으로 카메라 고정
//    - setDepth(100)으로 최상위 렌더링
//
// 7. 게임 상태 초기화
//    - distance = 0
//    - score = 0
//    - gameSpeed = BASE_SPEED
//    - isGameOver = false
//
// ============================================================
// [update(time, delta) — 매 프레임 실행]
// ============================================================
//
// 0. 게임오버 체크
//    - if (isGameOver) return; → 더 이상 업데이트 안 함
//
// 1. 거리 / 속도 업데이트
//    - distance += gameSpeed * (delta / 1000)
//    - gameSpeed 계산: BASE_SPEED + distance * 0.05 (MAX_SPEED 캡)
//    - relax 모드면: gameSpeed *= 0.5
//
// 2. 배경 스크롤
//    - bg1.tilePositionX += gameSpeed * 0.2 * (delta / 1000)
//    - bg2.tilePositionX += gameSpeed * 0.5 * (delta / 1000)
//    - ground.tilePositionX += gameSpeed * (delta / 1000)
//    → delta 기반으로 프레임 독립적 이동
//
// 3. 키보드 입력 처리
//    - JustDown(left) → player.moveLeft()
//    - JustDown(right) → player.moveRight()
//    - JustDown(up) → player.jump()
//    - JustDown(down) → player.slide()
//
// 4. 플레이어 업데이트
//    - player.update(delta) 호출
//    - 내부에서 바닥 착지 체크, 슬라이드 타이머 등 처리
//
// 5. HUD 업데이트
//    - scoreText.setText(`⭐ ${score}`)
//    - distanceText.setText(`${Math.floor(distance)}m`)
//
// ============================================================
// [충돌/장애물 — M2에서 구현]
// ============================================================
// - M1에서는 장애물 없이 무한히 달리는 상태
// - M2에서 ObstaclePool, SpawnManager, 충돌 로직 추가
//
// ============================================================
// [게임오버 처리]
// ============================================================
// - isGameOver = true
// - 플레이어 사망 애니메이션 (M2에서 상세)
// - 잠깐 딜레이 후 GameOver Scene으로 전환
//   → this.scene.start('GameOver', { score, distance, items })
//
// ============================================================
// [주의사항]
// ============================================================
// - delta 기반 계산으로 프레임 독립적 동작 보장
// - 모든 좌표 계산은 Constants의 상수 사용 (매직 넘버 금지)
// - 장애물/아이템은 M2에서 추가하므로 M1에서는 빈 게임 루프
// - 릴렉스 모드 분기는 create에서 모드 설정으로 해결
// ============================================================
