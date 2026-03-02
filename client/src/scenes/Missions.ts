import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_MISSIONS,
    SCENE_MAIN_MENU,
    MISSION_LABELS,
    LS_KEY_DAILY_MISSIONS,
    LS_KEY_STREAK,
} from '../utils/Constants';
import type { MissionType } from '../utils/Constants';
import { ApiClient, type Mission, type StreakInfo, type DailyMissionsResponse } from '../services/ApiClient';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';
import { SoundManager } from '../services/SoundManager';

// ─── 로컬 미션 캐시 구조 ────────────────────────────────────────────
interface LocalMissionCache {
    date: string;          // YYYY-MM-DD
    missions: Mission[];
    streak: StreakInfo;
}

function todayDateString(): string {
    return new Date().toISOString().slice(0, 10);
}

function defaultStreak(): StreakInfo {
    return {
        current_streak: 0,
        longest_streak: 0,
        last_play_date: null,
        today_reward_claimed: false,
    };
}

function defaultMissions(): Mission[] {
    return [
        {
            id: 1,
            mission_type: 'collect_mandarins',
            target_value: 10,
            current_value: 0,
            completed: 0,
            reward_claimed: 0,
            reward_type: 'mandarin',
            reward_amount: 5,
        },
        {
            id: 2,
            mission_type: 'run_distance',
            target_value: 500,
            current_value: 0,
            completed: 0,
            reward_claimed: 0,
            reward_type: 'mandarin',
            reward_amount: 10,
        },
        {
            id: 3,
            mission_type: 'dodge_obstacles',
            target_value: 20,
            current_value: 0,
            completed: 0,
            reward_claimed: 0,
            reward_type: 'mandarin',
            reward_amount: 8,
        },
    ];
}

// ─── 로컬스토리지 캐시 헬퍼 ──────────────────────────────────────────
function loadLocalCache(): LocalMissionCache | null {
    try {
        const raw = localStorage.getItem(LS_KEY_DAILY_MISSIONS);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LocalMissionCache;
        if (parsed.date !== todayDateString()) return null; // 날짜 바뀌면 무효
        return parsed;
    } catch {
        return null;
    }
}

function saveLocalCache(data: LocalMissionCache): void {
    try {
        localStorage.setItem(LS_KEY_DAILY_MISSIONS, JSON.stringify(data));
    } catch {
        // 저장 실패는 무시
    }
}

function loadLocalStreak(): StreakInfo {
    try {
        const raw = localStorage.getItem(LS_KEY_STREAK);
        if (!raw) return defaultStreak();
        return JSON.parse(raw) as StreakInfo;
    } catch {
        return defaultStreak();
    }
}

function saveLocalStreak(streak: StreakInfo): void {
    try {
        localStorage.setItem(LS_KEY_STREAK, JSON.stringify(streak));
    } catch {
        // 무시
    }
}

// ─── Missions Scene ───────────────────────────────────────────────────
export class Missions extends Phaser.Scene {
    private missions: Mission[] = [];
    private streak: StreakInfo = defaultStreak();
    private missionCards: Phaser.GameObjects.Container[] = [];
    private streakContainer: Phaser.GameObjects.Container | null = null;
    private loadingText: Phaser.GameObjects.Text | null = null;

    constructor() {
        super(SCENE_MISSIONS);
    }

    shutdown(): void {
        this.tweens.killAll();
        this.time.removeAllEvents();
    }

    create(): void {
        fadeIn(this);

        this.cameras.main.setBackgroundColor('#1A1A2E');

        // 타이틀
        this.add.text(GAME_WIDTH / 2, 80, '오늘의 미션', {
            fontFamily: 'Arial',
            fontSize: '40px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5);

        // 로딩 텍스트 (서버 응답 전 표시)
        this.loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '불러오는 중...', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#AAAAAA',
        }).setOrigin(0.5);

        // 돌아가기 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT - 80,
            label: '돌아가기',
            color: 0x555577,
            width: 240, height: 56, fontSize: '26px', radius: 14,
            callback: () => fadeToScene(this, SCENE_MAIN_MENU),
        });

        // 캐시 또는 기본값으로 즉시 렌더링 후, 서버에서 업데이트
        const cached = loadLocalCache();
        if (cached) {
            this.missions = cached.missions;
            this.streak = cached.streak;
            this.renderAll();
        }

        // 서버에서 최신 데이터 로드
        const api = ApiClient.getInstance();
        api.getDailyMissions()
            .then((data: DailyMissionsResponse | null) => {
                if (!this.scene.isActive()) return;

                if (data) {
                    this.missions = data.missions;
                    this.streak = data.streak;
                    // 서버 데이터 로컬 캐시 저장
                    saveLocalCache({
                        date: todayDateString(),
                        missions: this.missions,
                        streak: this.streak,
                    });
                    saveLocalStreak(this.streak);
                } else {
                    // 서버 미구현 — 로컬 캐시 또는 기본값 사용
                    if (!cached) {
                        this.missions = defaultMissions();
                        this.streak = loadLocalStreak();
                    }
                }
                this.renderAll();
            })
            .catch(() => {
                if (!this.scene.isActive()) return;
                if (!cached) {
                    this.missions = defaultMissions();
                    this.streak = loadLocalStreak();
                    this.renderAll();
                }
            });
    }

    // ─── 전체 렌더링 ──────────────────────────────────────────────────
    private renderAll(): void {
        if (this.loadingText) {
            this.loadingText.destroy();
            this.loadingText = null;
        }

        // 기존 카드/스트릭 제거 후 재렌더
        for (const card of this.missionCards) {
            card.destroy();
        }
        this.missionCards = [];
        if (this.streakContainer) {
            this.streakContainer.destroy();
            this.streakContainer = null;
        }

        this.renderStreakSection();
        this.renderMissionCards();
    }

    // ─── 스트릭 섹션 (y=200) ─────────────────────────────────────────
    private renderStreakSection(): void {
        this.streakContainer = this.add.container(0, 0);

        const sectionBg = this.add.graphics();
        const sectionX = GAME_WIDTH / 2 - 300;
        const sectionY = 140;
        const sectionW = 600;
        const sectionH = 90;
        sectionBg.fillStyle(0x2A2A4A, 1);
        sectionBg.fillRoundedRect(sectionX, sectionY, sectionW, sectionH, 16);
        this.streakContainer.add(sectionBg);

        // 연속 플레이 레이블
        const streakLabel = this.add.text(sectionX + 20, sectionY + 12, '연속 플레이', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#AAAAAA',
        });
        this.streakContainer.add(streakLabel);

        // 스트릭 수
        const streakNum = this.streak.current_streak;
        const streakText = this.add.text(sectionX + 20, sectionY + 36, `${streakNum}일 연속`, {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: streakNum >= 3 ? '#FF6B35' : '#FFFFFF',
            fontStyle: 'bold',
        });
        this.streakContainer.add(streakText);

        // 최장 기록
        const longestText = this.add.text(sectionX + 20, sectionY + 68, `최장: ${this.streak.longest_streak}일`, {
            fontFamily: 'Arial',
            fontSize: '15px',
            color: '#888888',
        });
        this.streakContainer.add(longestText);

        // 스트릭 보상 버튼
        if (!this.streak.today_reward_claimed) {
            const claimX = sectionX + sectionW - 150;
            const claimY = sectionY + sectionH / 2;

            const claimBg = this.add.graphics();
            claimBg.fillStyle(0xFF6B35, 1);
            claimBg.fillRoundedRect(claimX - 65, claimY - 22, 130, 44, 10);
            this.streakContainer.add(claimBg);

            const claimText = this.add.text(claimX, claimY, '보상 받기', {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#FFFFFF',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            this.streakContainer.add(claimText);

            const claimZone = this.add.zone(claimX, claimY, 130, 44)
                .setInteractive({ useHandCursor: true });
            this.streakContainer.add(claimZone);

            claimZone.on('pointerdown', () => {
                SoundManager.getInstance().playSfx('button');
                this.onClaimStreakReward(claimBg, claimText, claimZone);
            });

            // 골드 펄싱 글로우 효과
            this.tweens.add({
                targets: claimText,
                alpha: 0.6,
                duration: 700,
                yoyo: true,
                repeat: -1,
            });
        } else {
            const claimedText = this.add.text(sectionX + sectionW - 85, sectionY + sectionH / 2, '수령 완료', {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#666666',
            }).setOrigin(0.5);
            this.streakContainer.add(claimedText);
        }
    }

    // ─── 미션 카드 렌더링 (y=260, 440, 620) ──────────────────────────
    private renderMissionCards(): void {
        const cardStartY = 260;
        const cardGap = 180;

        this.missions.forEach((mission, index) => {
            const cardY = cardStartY + index * cardGap;
            const card = this.buildMissionCard(mission, cardY);
            this.missionCards.push(card);
        });
    }

    private buildMissionCard(mission: Mission, cardY: number): Phaser.GameObjects.Container {
        const container = this.add.container(0, 0);
        const cardX = GAME_WIDTH / 2 - 310;
        const cardW = 620;
        const cardH = 160;
        const isCompleted = mission.completed === 1;
        const isClaimed = mission.reward_claimed === 1;

        // 카드 배경
        const cardBg = this.add.graphics();
        let bgColor: number;
        if (isClaimed) {
            bgColor = 0x2A2A2A; // 수령 완료 — 어두운 회색
        } else if (isCompleted) {
            bgColor = 0x3A3A1A; // 완료 미수령 — 어두운 골드 배경
        } else {
            bgColor = 0x1E2A3A; // 진행 중 — 어두운 파랑
        }
        cardBg.fillStyle(bgColor, 1);
        cardBg.fillRoundedRect(cardX, cardY, cardW, cardH, 14);

        // 완료 테두리
        if (isCompleted && !isClaimed) {
            const border = this.add.graphics();
            border.lineStyle(2, 0xFFD700, 1);
            border.strokeRoundedRect(cardX, cardY, cardW, cardH, 14);
            container.add(border);
        }
        container.add(cardBg);

        // 미션 라벨
        const label = MISSION_LABELS[mission.mission_type as MissionType] ?? mission.mission_type;
        const labelColor = isClaimed ? '#666666' : '#FFFFFF';
        const labelText = this.add.text(cardX + 20, cardY + 18, label, {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: labelColor,
            fontStyle: 'bold',
        });
        container.add(labelText);

        // 보상 텍스트
        const rewardStr = `보상: 귤 x${mission.reward_amount}`;
        const rewardColor = isClaimed ? '#555555' : '#FFD700';
        const rewardText = this.add.text(cardX + 20, cardY + 48, rewardStr, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: rewardColor,
        });
        container.add(rewardText);

        // 진행도 바 (y = cardY + 90)
        const barX = cardX + 20;
        const barY = cardY + 84;
        const barW = isClaimed ? 340 : 300;
        const barH = 20;
        const progress = Math.min(mission.current_value / Math.max(mission.target_value, 1), 1);

        // 배경 바
        const barBg = this.add.graphics();
        barBg.fillStyle(0x111111, 1);
        barBg.fillRoundedRect(barX, barY, barW, barH, 8);
        container.add(barBg);

        // 진행 바 (항상 선언, progress > 0일 때만 채움)
        const barFill = this.add.graphics();
        if (progress > 0) {
            const fillColor = isClaimed ? 0x444444 : isCompleted ? 0xFFD700 : 0x4CAF50;
            barFill.fillStyle(fillColor, 1);
            barFill.fillRoundedRect(barX, barY, Math.floor(barW * progress), barH, 8);
        }
        container.add(barFill);

        // 진행도 텍스트 (current / target)
        const progressStr = `${mission.current_value} / ${mission.target_value}`;
        const progressColor = isClaimed ? '#555555' : '#AAAAAA';
        const progressText = this.add.text(barX + barW / 2, barY + barH / 2, progressStr, {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: progressColor,
        }).setOrigin(0.5, 0.5);
        container.add(progressText);

        // 진행도 % 텍스트 (바 오른쪽)
        const pctStr = `${Math.floor(progress * 100)}%`;
        const pctText = this.add.text(barX + barW + 10, barY + barH / 2, pctStr, {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: isClaimed ? '#555555' : '#AAAAAA',
        }).setOrigin(0, 0.5);
        container.add(pctText);

        // "보상 받기" 버튼 — 완료 & 미수령일 때만 표시
        if (isCompleted && !isClaimed) {
            const btnX = cardX + cardW - 100;
            const btnY = cardY + cardH / 2;
            const btnW2 = 140;
            const btnH2 = 44;

            const claimBg = this.add.graphics();
            claimBg.fillStyle(0xFFD700, 1);
            claimBg.fillRoundedRect(btnX - btnW2 / 2, btnY - btnH2 / 2, btnW2, btnH2, 10);
            container.add(claimBg);

            const claimLabel = this.add.text(btnX, btnY, '보상 받기', {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#1A1A00',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            container.add(claimLabel);

            const claimZone = this.add.zone(btnX, btnY, btnW2, btnH2)
                .setInteractive({ useHandCursor: true });
            container.add(claimZone);

            claimZone.on('pointerdown', () => {
                SoundManager.getInstance().playSfx('button');
                this.onClaimMissionReward(mission, container, claimBg, claimLabel, claimZone, barFill ?? null, progressText, pctText, rewardText, labelText);
            });

            // 골드 펄싱 글로우
            this.tweens.add({
                targets: claimLabel,
                alpha: 0.5,
                duration: 600,
                yoyo: true,
                repeat: -1,
            });
        } else if (isClaimed) {
            // 수령 완료 레이블
            const doneText = this.add.text(cardX + cardW - 95, cardY + cardH / 2, '수령 완료', {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#555555',
            }).setOrigin(0.5);
            container.add(doneText);
        }

        return container;
    }

    // ─── 미션 보상 수령 처리 ──────────────────────────────────────────
    private onClaimMissionReward(
        mission: Mission,
        container: Phaser.GameObjects.Container,
        claimBg: Phaser.GameObjects.Graphics,
        claimLabel: Phaser.GameObjects.Text,
        claimZone: Phaser.GameObjects.Zone,
        barFill: Phaser.GameObjects.Graphics,
        progressText: Phaser.GameObjects.Text,
        pctText: Phaser.GameObjects.Text,
        rewardText: Phaser.GameObjects.Text,
        labelText: Phaser.GameObjects.Text,
    ): void {
        // 즉시 UI 반영 (낙관적 업데이트)
        mission.reward_claimed = 1;
        claimZone.disableInteractive();

        // 버튼 배경 숨김 (Graphics 좌표 복잡성 회피 — 라벨로 상태 표현)
        claimBg.setAlpha(0.3);

        claimLabel.setText('수령 완료');
        claimLabel.setStyle({ color: '#999999' });
        this.tweens.killTweensOf(claimLabel);
        claimLabel.setAlpha(1);

        // 진행 바 색상 → 회색 (clear 후 재렌더 불필요 — alpha로 처리)
        barFill.setAlpha(0.3);

        progressText.setStyle({ color: '#555555' });
        pctText.setStyle({ color: '#555555' });
        rewardText.setStyle({ color: '#555555' });
        labelText.setStyle({ color: '#666666' });

        // 로컬 캐시 업데이트
        const cached = loadLocalCache();
        if (cached) {
            const found = cached.missions.find(m => m.id === mission.id);
            if (found) {
                found.reward_claimed = 1;
                saveLocalCache(cached);
            }
        }

        // 서버 업데이트 (fire-and-forget)
        ApiClient.getInstance().claimMissionReward(mission.id);

        // 보상 팝업 텍스트
        this.showRewardPopup(container, `+귤 x${mission.reward_amount}`);
    }

    // ─── 스트릭 보상 수령 처리 ────────────────────────────────────────
    private onClaimStreakReward(
        claimBg: Phaser.GameObjects.Graphics,
        claimText: Phaser.GameObjects.Text,
        claimZone: Phaser.GameObjects.Zone,
    ): void {
        this.streak.today_reward_claimed = true;
        claimZone.disableInteractive();
        this.tweens.killTweensOf(claimText);
        claimText.setText('수령 완료');
        claimText.setAlpha(1);
        claimText.setStyle({ color: '#666666' });
        claimBg.setAlpha(0.3);

        // 로컬 캐시 업데이트
        const cached = loadLocalCache();
        if (cached) {
            cached.streak.today_reward_claimed = true;
            saveLocalCache(cached);
        }
        saveLocalStreak(this.streak);

        // 서버 업데이트 (fire-and-forget)
        ApiClient.getInstance().claimStreakReward();

        // 보상 팝업
        if (this.streakContainer) {
            this.showRewardPopupAt(GAME_WIDTH / 2, 210, '+귤 x5 (연속 보너스)');
        }
    }

    // ─── 보상 팝업 애니메이션 ─────────────────────────────────────────
    private showRewardPopup(container: Phaser.GameObjects.Container, text: string): void {
        const popup = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, text, {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(500);
        container.add(popup);

        this.tweens.add({
            targets: popup,
            y: popup.y - 80,
            alpha: 0,
            duration: 1200,
            ease: 'Power2',
            onComplete: () => popup.destroy(),
        });
    }

    private showRewardPopupAt(x: number, y: number, text: string): void {
        const popup = this.add.text(x, y, text, {
            fontFamily: 'Arial',
            fontSize: '26px',
            color: '#FF6B35',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(500);

        this.tweens.add({
            targets: popup,
            y: y - 60,
            alpha: 0,
            duration: 1200,
            ease: 'Power2',
            onComplete: () => popup.destroy(),
        });
    }
}
