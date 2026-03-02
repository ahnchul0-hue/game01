# STEP 0. 사전 준비 — 진행 요약

## 1. 프로젝트 개요
- **게임명**: 카피바라 러너 (Capybara Runner)
- **레퍼런스**: 토킹톰 골드런 (무한 러닝 게임)
- **테마**: 카피바라가 온천을 찾아 떠나는 힐링 러닝 게임

## 2. 차별화 포인트

| 요소 | 토킹톰 골드런 | 카피바라 러너 |
|------|--------------|--------------|
| 세계관 | 도둑에게 금 되찾기 | 온천을 찾아 떠나는 여정 |
| 수집 아이템 | 금괴 | 귤, 과일, 온천 재료 |
| 꾸미기 | 집 수리 | 나만의 온천 꾸미기 |
| 파워업 | 자석, 헬멧, 비행기 | 수박헬멧, 오리튜브, 친구동물 합류 |
| 배경 | 도시/도로/지붕 | 숲속 → 강가 → 마을 → 온천 |
| 특수 능력 | 없음 | 릴렉스 모드 (동물 친구 도움) |
| 감성 | 액션/추격 | 힐링/귀여움/느긋함 |

## 3. 기술스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 프론트엔드 | Phaser 3 + TypeScript + Vite | 3.90.0 / 5.9.3 / 7.3.1 |
| 백엔드 | Rust + Axum | 0.8.x |
| DB | SQLite | - |
| 배포 | 서버 직접 배포 (Nginx 리버스 프록시) | - |

## 4. 서버 환경
- OS: Ubuntu 24.04
- Node.js: v24.14.0
- Git: v2.43.0
- Rust: 미설치 (설치 예정)
- Nginx: 미설치 (설치 예정)

## 5. 마일스톤 (5개)
1. **M1**: 프로젝트 셋업 (프론트 + Rust 백엔드) + 카피바라 달리기 + 기본 조작
2. **M2**: 장애물 + 귤 수집 + 충돌 판정 + 점수 → Rust API로 점수 저장
3. **M3**: 파워업 + 스테이지 배경 전환
4. **M4**: 온천 꾸미기 + 캐릭터 스킨 → Rust API로 유저 데이터 관리
5. **M5**: 사운드/UI + Nginx 배포 + 리더보드

## 6. 인프라 설정 완료 항목
- [x] Git 초기화 + GitHub 리포지토리 연결 (git@github.com:ahnchul0-hue/game01.git)
- [x] SSH 키 생성 + GitHub 등록
- [x] MCP 서버 6개 설정 (context7, sequential-thinking, playwright, shadcn, mcp-tailwind-gemini, serena)
- [x] 개발 워크플로우 문서화 (0.instructions.txt)
- [x] clx alias 설정 (claude --dangerously-skip-permissions)

## 7. 다음 단계
- [ ] STEP 0 완료: PRD.md + README.md 작성
- [ ] STEP 1: research.md 작성 (코드리서치)
- [ ] STEP 2: plan.md 작성 (계획)
- [ ] Rust, Nginx 설치
