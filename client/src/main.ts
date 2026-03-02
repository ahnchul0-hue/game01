// ============================================================
// main.ts — 게임 엔트리포인트
// ============================================================
// 이 파일은 Phaser.Game 인스턴스를 생성하는 진입점이다.
// HTML의 <div id="game-container">에 캔버스를 삽입한다.
//
// [GameConfig 설정]
// 1. type: Phaser.AUTO → WebGL 우선, 불가 시 Canvas 폴백
// 2. width/height: Constants의 GAME_WIDTH(720), GAME_HEIGHT(1280)
// 3. parent: 'game-container' → index.html의 div id와 매칭
// 4. scale:
//    - mode: Phaser.Scale.FIT → 화면에 맞게 축소/확대 (비율 유지)
//    - autoCenter: Phaser.Scale.CENTER_BOTH → 상하좌우 중앙 정렬
// 5. physics:
//    - default: 'arcade'
//    - arcade.gravity.y: Constants의 GRAVITY (800)
//    - arcade.debug: false (개발 중 true로 전환 가능)
// 6. scene: [Boot, Preloader, MainMenu, Game, GameOver]
//    - 배열 순서대로 등록, 첫 번째(Boot)가 자동 시작
// 7. backgroundColor: 하늘색 계열 (#87CEEB) — 기본 배경
//
// [주의사항]
// - pixelArt: false (부드러운 스프라이트 렌더링)
// - 모바일 최적화: antialias false 고려 (성능 vs 품질 트레이드오프)
// - Phaser.Game 인스턴스는 전역에 하나만 존재
// ============================================================
