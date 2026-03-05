import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_MISSIONS,
    SCENE_MAIN_MENU,
    LS_KEY_DAILY_MISSIONS,
    LS_KEY_STREAK,
    FONT_FAMILY,
} from '../utils/Constants';
import { ApiClient, type Mission, type StreakInfo, type DailyMissionsResponse } from '../services/ApiClient';
import { InventoryManager } from '../services/InventoryManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';
import { SoundManager } from '../services/SoundManager';
import { MissionCard } from '../ui/MissionCard';

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
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.date !== todayDateString() || !Array.isArray(parsed.missions)) return null;
        return parsed as LocalMissionCache;
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
        const parsed = JSON.parse(raw);
        // C4: 구조 검증 — 필수 필드 타입 확인
        if (
            parsed === null || typeof parsed !== 'object' ||
            typeof parsed.current_streak !== 'number' ||
            typeof parsed.longest_streak !== 'number' ||
            (parsed.last_play_date !== null && typeof parsed.last_play_date !== 'string') ||
            typeof parsed.today_reward_claimed !== 'boolean'
        ) {
            console.warn('[loadLocalStreak] Malformed streak data, using defaults');
            return defaultStreak();
        }
        return parsed as StreakInfo;
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
    private missionCards: MissionCard[] = [];
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
            fontFamily: FONT_FAMILY,
            fontSize: '40px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5);

        // 로딩 텍스트 (서버 응답 전 표시)
        this.loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '불러오는 중...', {
            fontFamily: FONT_FAMILY,
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
            fontFamily: FONT_FAMILY,
            fontSize: '18px',
            color: '#AAAAAA',
        });
        this.streakContainer.add(streakLabel);

        // 스트릭 수
        const streakNum = this.streak.current_streak;
        const streakText = this.add.text(sectionX + 20, sectionY + 36, `${streakNum}일 연속`, {
            fontFamily: FONT_FAMILY,
            fontSize: '28px',
            color: streakNum >= 3 ? '#FF6B35' : '#FFFFFF',
            fontStyle: 'bold',
        });
        this.streakContainer.add(streakText);

        // 최장 기록
        const longestText = this.add.text(sectionX + 20, sectionY + 68, `최장: ${this.streak.longest_streak}일`, {
            fontFamily: FONT_FAMILY,
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
                fontFamily: FONT_FAMILY,
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
                fontFamily: FONT_FAMILY,
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
            const card = new MissionCard(this, mission, {
                cardY,
                onRewardClaimed: (claimedMission) => this.onMissionRewardClaimed(claimedMission),
            });
            this.missionCards.push(card);
        });
    }

    // ─── 미션 보상 수령 후 처리 (MissionCard 콜백) ───────────────────
    // UI 낙관적 업데이트가 끝난 뒤 호출되므로 여기서 서버 + 인벤토리를 처리한다.
    private onMissionRewardClaimed(mission: Mission): void {
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

        // 로컬 인벤토리에 보상 반영
        const rewardItems = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
        const rewardType = mission.reward_type as keyof typeof rewardItems;
        if (rewardType in rewardItems) {
            rewardItems[rewardType] = mission.reward_amount;
        }
        InventoryManager.getInstance().addItems(rewardItems);
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

        // 로컬 인벤토리에 연속 보상 반영
        const cycleDay = ((this.streak.current_streak - 1) % 7) + 1;
        const streakReward = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
        if (cycleDay <= 3) {
            streakReward.mandarin = 5;
        } else if (cycleDay <= 6) {
            streakReward.watermelon = 3;
        } else {
            streakReward.hotspring_material = 2;
        }
        InventoryManager.getInstance().addItems(streakReward);

        // 보상 팝업
        if (this.streakContainer) {
            let streakRewardText: string;
            if (cycleDay <= 3) {
                streakRewardText = '+귤 x5 (연속 보너스)';
            } else if (cycleDay <= 6) {
                streakRewardText = '+수박 x3 (연속 보너스)';
            } else {
                streakRewardText = '+온천 재료 x2 (연속 보너스)';
            }
            this.showRewardPopupAt(GAME_WIDTH / 2, 210, streakRewardText);
        }
    }

    // ─── 보상 팝업 애니메이션 (스트릭용) ────────────────────────────
    private showRewardPopupAt(x: number, y: number, text: string): void {
        const popup = this.add.text(x, y, text, {
            fontFamily: FONT_FAMILY,
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
