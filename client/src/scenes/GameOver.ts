import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_GAME_OVER,
    SCENE_GAME,
    SCENE_MAIN_MENU,
    SCENE_ONSEN,
    SCENE_QUEST_SELECT,
    LS_KEY_USER_ID,
    FONT_FAMILY,
} from '../utils/Constants';
import type { GameMode, CollectedItems, SkinConfig } from '../utils/Constants';
import { SKIN_CONFIGS } from '../utils/Constants';
import { DEFAULT_QUESTS } from '../systems/QuestManager';
import { getUnlockProgress, getOnsenLevelIndex, getTotalItems, getOnsenLevel, type UnlockStats } from '../utils/OnsenLogic';
import { ApiClient, type ScoreEntry } from '../services/ApiClient';
import { InventoryManager } from '../services/InventoryManager';
import { SoundManager } from '../services/SoundManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';
import { ATLAS_GAME_KEY } from '../utils/TextureAtlasBuilder';

interface GameOverData {
    score?: number;
    distance?: number;
    mode?: GameMode;
    collectedItems?: CollectedItems;
    dodgedObstacles?: number;
    questId?: string;
    questCompleted?: boolean;
    questRewardMandarin?: number;
}

export class GameOver extends Phaser.Scene {
    private finalScore = 0;
    private finalDistance = 0;
    private lastMode: GameMode = 'normal';
    private collectedItems: CollectedItems = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
    private dodgedObstacles = 0;
    private questId: string | null = null;
    private questCompleted = false;
    private questRewardMandarin = 0;

    constructor() {
        super(SCENE_GAME_OVER);
    }

    shutdown(): void {
        this.tweens.killAll();
        this.time.removeAllEvents();
    }

    init(data: GameOverData): void {
        this.finalScore = data.score ?? 0;
        this.finalDistance = data.distance ?? 0;
        this.lastMode = data.mode ?? 'normal';
        this.collectedItems = data.collectedItems ?? { mandarin: 0, watermelon: 0, hotspring_material: 0 };
        this.dodgedObstacles = data.dodgedObstacles ?? 0;
        this.questId = data.questId ?? null;
        this.questCompleted = data.questCompleted ?? false;
        this.questRewardMandarin = data.questRewardMandarin ?? 0;
    }

    create(): void {
        // 페이드인
        fadeIn(this);

        // BGM 정지 (Game에서 이미 했지만 안전장치)
        SoundManager.getInstance().stopBgm();

        // 점수 API 전송 후 리더보드 로드 (릴렉스/퀘스트 모드는 리더보드 제외)
        const totalItems = this.collectedItems.mandarin
            + this.collectedItems.watermelon
            + this.collectedItems.hotspring_material;
        const api = ApiClient.getInstance();
        if (this.lastMode !== 'relax' && this.lastMode !== 'quest') {
            api.submitScore(this.finalScore, this.finalDistance, totalItems)
                .then(() => api.getTopScores(5))
                .then(scores => {
                    if (this.scene && this.scene.isActive()) this.showLeaderboard(scores);
                })
                .catch((err) => { console.warn('[GameOver] Score/leaderboard failed:', err); });
        }

        // 일일 미션 진행도 업데이트 (fire-and-forget)
        if (this.collectedItems.mandarin > 0) {
            api.updateMissionProgress('collect_mandarins', this.collectedItems.mandarin);
        }
        if (this.finalDistance > 0) {
            api.updateMissionProgress('run_distance', this.finalDistance);
        }
        if (this.dodgedObstacles > 0) {
            api.updateMissionProgress('dodge_obstacles', this.dodgedObstacles);
        }

        // M4: 인벤토리 누적 + 최고 거리 갱신
        // 퀘스트 완료 보상 귤은 Game.ts에서 이미 반영했으므로 중복 방지
        const inventoryMgr = InventoryManager.getInstance();
        if (this.lastMode !== 'quest') {
            inventoryMgr.addItems(this.collectedItems);
        }
        inventoryMgr.updateMaxDistance(this.finalDistance);

        // 어두운 오버레이
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // 퀘스트 모드 전용 헤더 — 성공/실패 분기
        const isQuestMode = this.lastMode === 'quest';

        let titleText: string;
        let titleColor: string;
        if (isQuestMode && this.questCompleted) {
            titleText = 'QUEST CLEAR!';
            titleColor = '#FFD700';
        } else if (isQuestMode && !this.questCompleted) {
            titleText = 'QUEST FAIL';
            titleColor = '#EF9A9A';
        } else {
            titleText = 'GAME OVER';
            titleColor = '#FF6B6B';
        }

        // 타이틀 텍스트
        const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.15, titleText, {
            fontFamily: FONT_FAMILY, fontSize: '56px', color: titleColor,
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5);

        // 등장 애니메이션
        title.setY(title.y - 50);
        title.setAlpha(0);
        this.tweens.add({
            targets: title, y: title.y + 50, alpha: 1,
            duration: 500, ease: 'Bounce.easeOut',
        });

        // 퀘스트 모드: 퀘스트 설명 + 결과 표시
        if (isQuestMode) {
            this.showQuestResult();
        }

        // 카피바라 (선택된 스킨)
        const selectedSkin = inventoryMgr.getSelectedSkin();
        const capybara = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, `capybara-${selectedSkin}`);
        capybara.setScale(2);
        capybara.setAlpha(0.7);

        // 점수 카운트업 애니메이션
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.38, 'Score', {
            fontFamily: FONT_FAMILY, fontSize: '24px', color: '#AAAAAA',
        }).setOrigin(0.5);

        const scoreDisplay = { value: 0 };
        const scoreText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.43, '0', {
            fontFamily: FONT_FAMILY, fontSize: '48px', color: '#FFD700', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.tweens.add({
            targets: scoreDisplay, value: this.finalScore, duration: 1000, ease: 'Power1',
            onUpdate: () => scoreText.setText(Math.floor(scoreDisplay.value).toString()),
            onComplete: () => {
                // G2: New Record detection
                this.checkNewRecord(scoreText);
            },
        });

        // G4: Score Breakdown (sequential animation below score)
        this.showScoreBreakdown();

        // 거리 표시
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.50, `${this.finalDistance}m`, {
            fontFamily: FONT_FAMILY, fontSize: '28px', color: '#FFFFFF',
        }).setOrigin(0.5);

        // M2: 수집 아이템 표시
        const itemY = GAME_HEIGHT * 0.56;
        const itemSpacing = 140;
        const startX = GAME_WIDTH / 2 - itemSpacing;

        this.createItemDisplay(startX, itemY, 'item-mandarin', this.collectedItems.mandarin);
        this.createItemDisplay(startX + itemSpacing, itemY, 'item-watermelon', this.collectedItems.watermelon);
        this.createItemDisplay(startX + itemSpacing * 2, itemY, 'item-hotspring_material', this.collectedItems.hotspring_material);

        // 최고 거리
        const bestDistance = inventoryMgr.getMaxDistance();
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.60, `BEST: ${bestDistance}m`, {
            fontFamily: FONT_FAMILY, fontSize: '18px', color: '#AAAAAA',
        }).setOrigin(0.5);

        // B3: 거리 보너스 보상 상자 (normal 모드만)
        if (this.lastMode === 'normal' && this.finalDistance >= 100) {
            const bonus = this.calculateDistanceBonus();
            inventoryMgr.addItems(bonus);
            this.showRewardBox(bonus);
        }

        // 다음 스킨 잠금해제 힌트
        const hint = this.getNextUnlockHint(inventoryMgr);
        if (hint) {
            this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.70, hint, {
                fontFamily: FONT_FAMILY, fontSize: '14px', color: '#81C784',
            }).setOrigin(0.5);
        }

        // 리더보드 영역 (비동기 로드 — 0.70 이하 표시됨, 퀘스트 모드는 제외)

        // 재시작 + 온천 (같은 줄)
        // 퀘스트 모드: RETRY → 퀘스트 재도전, 좌측 버튼은 퀘스트 목록
        if (this.lastMode === 'quest') {
            createButton(this, {
                x: GAME_WIDTH / 2 - 110, y: GAME_HEIGHT * 0.80,
                label: '재도전', color: 0x4CAF50, width: 180, height: 48,
                callback: () => fadeToScene(this, SCENE_GAME, { mode: 'quest', questId: this.questId ?? undefined }),
            });
            createButton(this, {
                x: GAME_WIDTH / 2 + 110, y: GAME_HEIGHT * 0.80,
                label: '퀘스트 목록', color: 0xF57C00, width: 180, height: 48,
                callback: () => fadeToScene(this, SCENE_QUEST_SELECT),
            });
        } else {
            createButton(this, {
                x: GAME_WIDTH / 2 - 110, y: GAME_HEIGHT * 0.80,
                label: 'RETRY', color: 0x4CAF50, width: 180, height: 48,
                callback: () => fadeToScene(this, SCENE_GAME, { mode: this.lastMode }),
            });
            createButton(this, {
                x: GAME_WIDTH / 2 + 110, y: GAME_HEIGHT * 0.80,
                label: 'ONSEN', color: 0xFF8C00, width: 180, height: 48,
                callback: () => fadeToScene(this, SCENE_ONSEN),
            });
        }

        // 공유 + 메뉴 (같은 줄)
        createButton(this, {
            x: GAME_WIDTH / 2 - 110, y: GAME_HEIGHT * 0.88,
            label: 'SHARE', color: 0x1DA1F2, width: 180, height: 48,
            callback: () => this.shareScore(),
        });
        createButton(this, {
            x: GAME_WIDTH / 2 + 110, y: GAME_HEIGHT * 0.88,
            label: 'MENU', color: 0x757575, width: 180, height: 48,
            callback: () => fadeToScene(this, SCENE_MAIN_MENU),
        });
    }

    /** B3: 거리 기반 보너스 보상 계산 */
    private calculateDistanceBonus(): CollectedItems {
        const d = this.finalDistance;
        const bonus: CollectedItems = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
        if (d >= 1000) {
            bonus.mandarin = 3 + Math.floor(Math.random() * 5);     // 3~7
            bonus.watermelon = 1 + Math.floor(Math.random() * 2);   // 1~2
            bonus.hotspring_material = Math.floor(Math.random() * 2); // 0~1
        } else if (d >= 500) {
            bonus.mandarin = 2 + Math.floor(Math.random() * 4);     // 2~5
            bonus.watermelon = Math.floor(Math.random() * 2);        // 0~1
        } else if (d >= 100) {
            bonus.mandarin = 1 + Math.floor(Math.random() * 3);     // 1~3
        }
        return bonus;
    }

    /** B3: 보상 상자 패널 표시 */
    private showRewardBox(bonus: CollectedItems): void {
        const boxY = GAME_HEIGHT * 0.63;
        const boxH = 60;

        // 패널 배경
        const bg = this.add.graphics();
        bg.fillStyle(0x2E7D32, 0.85);
        bg.fillRoundedRect(100, boxY, GAME_WIDTH - 200, boxH, 12);

        // 제목
        this.add.text(GAME_WIDTH / 2, boxY + 14, '거리 보너스!', {
            fontFamily: FONT_FAMILY, fontSize: '16px', color: '#FFD700', fontStyle: 'bold',
        }).setOrigin(0.5);

        // 보상 아이템 나열
        const parts: string[] = [];
        if (bonus.mandarin > 0) parts.push(`귤 +${bonus.mandarin}`);
        if (bonus.watermelon > 0) parts.push(`수박 +${bonus.watermelon}`);
        if (bonus.hotspring_material > 0) parts.push(`온천재료 +${bonus.hotspring_material}`);

        const rewardLabel = this.add.text(GAME_WIDTH / 2, boxY + 38, parts.join('  '), {
            fontFamily: FONT_FAMILY, fontSize: '18px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0);

        // 등장 애니메이션
        this.tweens.add({
            targets: rewardLabel, alpha: 1, duration: 400, delay: 800, ease: 'Power2',
        });
    }

    private getNextUnlockHint(inventoryMgr: InventoryManager): string | null {
        const unlockedSkins = inventoryMgr.getUnlockedSkins();
        const inventory = inventoryMgr.getInventory();
        const layout = inventoryMgr.getOnsenLayout();
        const onsenLevel = getOnsenLevel(layout.placedItems.length);
        const stats: UnlockStats = {
            maxDistance: inventoryMgr.getMaxDistance(),
            onsenLevelIndex: getOnsenLevelIndex(onsenLevel),
            totalItemsCollected: getTotalItems(inventory),
        };

        let bestCandidate: { config: SkinConfig; progress: number } | null = null;
        for (const config of SKIN_CONFIGS) {
            if (unlockedSkins.includes(config.id)) continue;
            const progress = getUnlockProgress(config.unlockCondition, stats);
            if (!bestCandidate || progress > bestCandidate.progress) {
                bestCandidate = { config, progress };
            }
        }

        if (!bestCandidate) return null;
        const pct = Math.floor(bestCandidate.progress * 100);
        return `Next: ${bestCandidate.config.name} (${pct}%) — ${bestCandidate.config.unlockDescription}`;
    }

    private createItemDisplay(x: number, y: number, frame: string, count: number): void {
        const icon = this.add.image(x, y, ATLAS_GAME_KEY, frame).setScale(0.8);
        if (!icon.texture || icon.texture.key === '__MISSING') {
            icon.destroy();
        }
        this.add.text(x, y + 30, `x${count}`, {
            fontFamily: FONT_FAMILY, fontSize: '20px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
    }

    private shareScore(): void {
        const text = `Capybara Runner: ${this.finalScore.toLocaleString()}pts / ${this.finalDistance}m`;

        if (navigator.share) {
            navigator.share({ title: 'Capybara Runner', text }).catch(() => {});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showShareToast('Copied!');
            }).catch(() => {});
        }
    }

    /** G2: Check and display new personal record */
    private checkNewRecord(scoreText: Phaser.GameObjects.Text): void {
        if (this.lastMode === 'relax') return;

        const LS_KEY = 'capybara_max_score';
        const prevBest = parseInt(localStorage.getItem(LS_KEY) ?? '0', 10) || 0;

        if (this.finalScore > prevBest && this.finalScore > 0) {
            localStorage.setItem(LS_KEY, this.finalScore.toString());

            const recordText = this.add.text(
                GAME_WIDTH / 2, scoreText.y - 40, 'NEW RECORD!',
                {
                    fontFamily: FONT_FAMILY, fontSize: '32px', color: '#FFD700',
                    fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
                },
            ).setOrigin(0.5).setScale(0).setAlpha(0);

            this.tweens.add({
                targets: recordText,
                scale: 1,
                alpha: 1,
                duration: 600,
                ease: 'Back.easeOut',
            });

            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate([50, 30, 50, 30, 100]);
            }
        }
    }

    /** G4: Show itemized score breakdown with sequential animation */
    private showScoreBreakdown(): void {
        const baseY = GAME_HEIGHT * 0.465;
        const lineHeight = 22;
        const totalItemCount = this.collectedItems.mandarin
            + this.collectedItems.watermelon
            + this.collectedItems.hotspring_material;
        const distanceBonus = Math.floor(this.finalDistance * 0.5);

        const lines = [
            { label: `아이템 수집: ${totalItemCount}개`, delay: 1200 },
            { label: `거리 보너스: +${distanceBonus}점`, delay: 1400 },
            { label: `총 점수: ${this.finalScore}점`, delay: 1600 },
        ];

        lines.forEach((line, i) => {
            const text = this.add.text(
                GAME_WIDTH / 2, baseY + i * lineHeight, line.label,
                {
                    fontFamily: FONT_FAMILY, fontSize: '20px', color: '#BBBBBB',
                },
            ).setOrigin(0.5).setAlpha(0);

            this.time.delayedCall(line.delay, () => {
                this.tweens.add({
                    targets: text,
                    alpha: 1,
                    duration: 300,
                    ease: 'Power2',
                });
            });
        });
    }

    private showShareToast(message: string): void {
        const toast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.93, message, {
            fontFamily: FONT_FAMILY, fontSize: '16px', color: '#FFFFFF',
            backgroundColor: '#333333', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
            targets: toast, alpha: 0, duration: 1500, delay: 800,
            onComplete: () => toast.destroy(),
        });
    }

    private showLeaderboard(scores: ScoreEntry[]): void {
        if (scores.length === 0) return;

        const startY = GAME_HEIGHT * 0.70;
        const userId = localStorage.getItem(LS_KEY_USER_ID);

        this.add.text(GAME_WIDTH / 2, startY, 'TOP SCORES', {
            fontFamily: FONT_FAMILY, fontSize: '18px', color: '#FFD700', fontStyle: 'bold',
        }).setOrigin(0.5);

        scores.forEach((entry, i) => {
            const isMe = entry.user_id === userId;
            const color = isMe ? '#FFD700' : '#CCCCCC';
            const prefix = isMe ? '▶ ' : '  ';
            const label = `${prefix}#${i + 1}  ${entry.score.toLocaleString()}  ${entry.distance}m`;
            this.add.text(GAME_WIDTH / 2, startY + 22 + i * 20, label, {
                fontFamily: FONT_FAMILY, fontSize: '15px', color,
            }).setOrigin(0.5);
        });
    }

    /**
     * 퀘스트 모드 전용 결과 패널 표시
     * 성공 시: 완료 메시지 + 귤 보상 표시
     * 실패 시: 퀘스트 이름 + 실패 메시지
     */
    private showQuestResult(): void {
        const questDef = this.questId
            ? DEFAULT_QUESTS.find(q => q.id === this.questId) ?? null
            : null;

        const panelY = GAME_HEIGHT * 0.25;
        const panelH = 140;

        // 패널 배경
        const panelBg = this.add.graphics();
        if (this.questCompleted) {
            panelBg.fillStyle(0x1B5E20, 0.85);
        } else {
            panelBg.fillStyle(0x4A0000, 0.85);
        }
        panelBg.fillRoundedRect(50, panelY, GAME_WIDTH - 100, panelH, 14);

        // 퀘스트 이름
        const questName = questDef ? questDef.description : '퀘스트';
        this.add.text(GAME_WIDTH / 2, panelY + 18, questName, {
            fontFamily: FONT_FAMILY,
            fontSize: '20px',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        if (this.questCompleted) {
            // 완료 메시지
            this.add.text(GAME_WIDTH / 2, panelY + 52, '목표 달성!', {
                fontFamily: FONT_FAMILY, fontSize: '26px', color: '#FFD700', fontStyle: 'bold',
            }).setOrigin(0.5);

            // 보상 귤 표시
            this.add.text(GAME_WIDTH / 2, panelY + 90, `귤 +${this.questRewardMandarin}개 획득!`, {
                fontFamily: FONT_FAMILY, fontSize: '20px', color: '#FFA726',
            }).setOrigin(0.5);

            // 반짝임 효과
            const stars = this.add.text(GAME_WIDTH / 2, panelY + 118, '★ ★ ★', {
                fontFamily: FONT_FAMILY, fontSize: '22px', color: '#FFD700',
            }).setOrigin(0.5);
            this.tweens.add({
                targets: stars, alpha: 0.3, duration: 600,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        } else {
            // 실패 메시지
            this.add.text(GAME_WIDTH / 2, panelY + 52, '목표 미달..', {
                fontFamily: FONT_FAMILY, fontSize: '24px', color: '#EF9A9A',
            }).setOrigin(0.5);

            if (questDef) {
                this.add.text(GAME_WIDTH / 2, panelY + 88, `다시 도전해보세요!`, {
                    fontFamily: FONT_FAMILY, fontSize: '18px', color: '#AAAAAA',
                }).setOrigin(0.5);
            }
        }
    }

}
