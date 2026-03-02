import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_GAME_OVER,
    SCENE_GAME,
    SCENE_MAIN_MENU,
    SCENE_ONSEN,
    LS_KEY_USER_ID,
} from '../utils/Constants';
import type { GameMode, CollectedItems, SkinConfig } from '../utils/Constants';
import { SKIN_CONFIGS } from '../utils/Constants';
import { getUnlockProgress, getOnsenLevelIndex, getTotalItems, getOnsenLevel, type UnlockStats } from '../utils/OnsenLogic';
import { ApiClient, type ScoreEntry } from '../services/ApiClient';
import { InventoryManager } from '../services/InventoryManager';
import { SoundManager } from '../services/SoundManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';

interface GameOverData {
    score?: number;
    distance?: number;
    mode?: GameMode;
    collectedItems?: CollectedItems;
    dodgedObstacles?: number;
}

export class GameOver extends Phaser.Scene {
    private finalScore = 0;
    private finalDistance = 0;
    private lastMode: GameMode = 'normal';
    private collectedItems: CollectedItems = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
    private dodgedObstacles = 0;

    constructor() {
        super(SCENE_GAME_OVER);
    }

    shutdown(): void {
        this.tweens.killAll();
    }

    init(data: GameOverData): void {
        this.finalScore = data.score ?? 0;
        this.finalDistance = data.distance ?? 0;
        this.lastMode = data.mode ?? 'normal';
        this.collectedItems = data.collectedItems ?? { mandarin: 0, watermelon: 0, hotspring_material: 0 };
        this.dodgedObstacles = data.dodgedObstacles ?? 0;
    }

    create(): void {
        // 페이드인
        fadeIn(this);

        // BGM 정지 (Game에서 이미 했지만 안전장치)
        SoundManager.getInstance().stopBgm();

        // 점수 API 전송 후 리더보드 로드
        const totalItems = this.collectedItems.mandarin
            + this.collectedItems.watermelon
            + this.collectedItems.hotspring_material;
        const api = ApiClient.getInstance();
        api.submitScore(this.finalScore, this.finalDistance, totalItems)
            .then(() => api.getTopScores(5))
            .then(scores => {
                if (this.scene && this.scene.isActive()) this.showLeaderboard(scores);
            })
            .catch(() => {});

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
        const inventoryMgr = InventoryManager.getInstance();
        inventoryMgr.addItems(this.collectedItems);
        inventoryMgr.updateMaxDistance(this.finalDistance);

        // 어두운 오버레이
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // 게임 오버 텍스트
        const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.15, 'GAME OVER', {
            fontFamily: 'Arial', fontSize: '56px', color: '#FF6B6B',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5);

        // 등장 애니메이션
        title.setY(title.y - 50);
        title.setAlpha(0);
        this.tweens.add({
            targets: title, y: title.y + 50, alpha: 1,
            duration: 500, ease: 'Bounce.easeOut',
        });

        // 카피바라 (선택된 스킨)
        const selectedSkin = inventoryMgr.getSelectedSkin();
        const capybara = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, `capybara-${selectedSkin}`);
        capybara.setScale(2);
        capybara.setAlpha(0.7);

        // 점수 카운트업 애니메이션
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.38, 'Score', {
            fontFamily: 'Arial', fontSize: '24px', color: '#AAAAAA',
        }).setOrigin(0.5);

        const scoreDisplay = { value: 0 };
        const scoreText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.43, '0', {
            fontFamily: 'Arial', fontSize: '48px', color: '#FFD700', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.tweens.add({
            targets: scoreDisplay, value: this.finalScore, duration: 1000, ease: 'Power1',
            onUpdate: () => scoreText.setText(Math.floor(scoreDisplay.value).toString()),
        });

        // 거리 표시
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.50, `${this.finalDistance}m`, {
            fontFamily: 'Arial', fontSize: '28px', color: '#FFFFFF',
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
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.62, `BEST: ${bestDistance}m`, {
            fontFamily: 'Arial', fontSize: '18px', color: '#AAAAAA',
        }).setOrigin(0.5);

        // 다음 스킨 잠금해제 힌트
        const hint = this.getNextUnlockHint(inventoryMgr);
        if (hint) {
            this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.66, hint, {
                fontFamily: 'Arial', fontSize: '14px', color: '#81C784',
            }).setOrigin(0.5);
        }

        // 리더보드 영역 (비동기 로드 — 0.70 이하 표시됨)

        // 재시작 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.80,
            label: 'RETRY', color: 0x4CAF50,
            callback: () => fadeToScene(this, SCENE_GAME, { mode: this.lastMode }),
        });

        // 온천 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.88,
            label: 'GO TO ONSEN', color: 0xFF8C00,
            callback: () => fadeToScene(this, SCENE_ONSEN),
        });

        // 메뉴 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.96,
            label: 'MENU', color: 0x757575,
            callback: () => fadeToScene(this, SCENE_MAIN_MENU),
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

    private createItemDisplay(x: number, y: number, texture: string, count: number): void {
        const icon = this.add.image(x, y, texture).setScale(0.8);
        // 텍스처가 아직 없는 경우 대비
        if (!icon.texture || icon.texture.key === '__MISSING') {
            icon.destroy();
        }
        this.add.text(x, y + 30, `x${count}`, {
            fontFamily: 'Arial', fontSize: '20px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
    }

    private showLeaderboard(scores: ScoreEntry[]): void {
        if (scores.length === 0) return;

        const startY = GAME_HEIGHT * 0.70;
        const userId = localStorage.getItem(LS_KEY_USER_ID);

        this.add.text(GAME_WIDTH / 2, startY, 'TOP SCORES', {
            fontFamily: 'Arial', fontSize: '18px', color: '#FFD700', fontStyle: 'bold',
        }).setOrigin(0.5);

        scores.forEach((entry, i) => {
            const isMe = entry.user_id === userId;
            const color = isMe ? '#FFD700' : '#CCCCCC';
            const prefix = isMe ? '▶ ' : '  ';
            const label = `${prefix}#${i + 1}  ${entry.score.toLocaleString()}  ${entry.distance}m`;
            this.add.text(GAME_WIDTH / 2, startY + 22 + i * 20, label, {
                fontFamily: 'Arial', fontSize: '15px', color,
            }).setOrigin(0.5);
        });
    }

}
