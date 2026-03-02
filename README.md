# Capybara Runner (카피바라 러너)

온천을 찾아 떠나는 카피바라의 힐링 무한 러닝 게임

## 소개

카피바라가 꿈꾸는 완벽한 온천을 찾아 숲, 강가, 마을을 달리는 2D 사이드스크롤 러너 게임입니다.
귤과 온천 재료를 수집하고, 나만의 온천을 꾸며보세요.

## 기술스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Phaser 3 (3.90.0) + TypeScript (5.9.3) + Vite (7.3.1) |
| 백엔드 | Rust + Axum (0.8.x) |
| DB | SQLite (sqlx) |
| 배포 | Ubuntu 24.04 + Nginx |

## 마일스톤

- [ ] **M1**: 프로젝트 셋업 + 카피바라 달리기 + 기본 조작 (좌우/점프/슬라이드)
- [ ] **M2**: 장애물 + 귤 수집 + 충돌 판정 + 점수 시스템 + Rust API 연동
- [ ] **M3**: 파워업 아이템 + 스테이지 배경 전환
- [ ] **M4**: 온천 꾸미기 + 캐릭터 스킨 + 유저 데이터 관리
- [ ] **M5**: 사운드/UI + Nginx 배포 + 리더보드

## 프로젝트 구조

```
game01/
├── 0.documents/          # 기획 문서 (PRD, 워크플로우)
├── client/               # Phaser 3 프론트엔드 (예정)
│   ├── src/
│   ├── public/
│   └── package.json
├── server/               # Rust + Axum 백엔드 (예정)
│   ├── src/
│   └── Cargo.toml
└── README.md
```

## 개발 환경 설정

### 요구사항
- Node.js >= 20
- Rust >= 1.75
- Nginx

### 프론트엔드
```bash
cd client
npm install
npm run dev
```

### 백엔드
```bash
cd server
cargo run
```

## 개발 워크플로우

`0.documents/0.instructions.txt`의 6단계 프로세스를 따릅니다:

1. **STEP 0** — 사전 준비 (PRD, README, 기술스택)
2. **STEP 1** — 코드리서치 (research.md)
3. **STEP 2** — 계획 (plan.md)
4. **STEP 3** — 주석달기
5. **STEP 4** — 구현 + 테스트
6. **STEP 5~6** — 피드백, 보안/문서 리뷰

## 라이선스

Private
