import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_COMPANION_SELECT,
    SCENE_MAIN_MENU,
    COMPANION_CONFIGS,
    type CompanionId,
    type CompanionConfig,
} from '../utils/Constants';
import {
    isCompanionUnlocked,
    getCompanionUnlockProgress,
    getOnsenLevelIndex,
    getTotalItems,
    getOnsenLevel,
    type UnlockStats,
} from '../utils/OnsenLogic';
import { InventoryManager } from '../services/InventoryManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';

export class CompanionSelect extends Phaser.Scene {
    private inventoryMgr!: InventoryManager;
    private selectedCompanion!: CompanionId;
    private unlockedCompanions!: CompanionId[];
    private previewGfx!: Phaser.GameObjects.Graphics;
    private previewNameText!: Phaser.GameObjects.Text;
    private previewAbilityText!: Phaser.GameObjects.Text;
    private cardBorders: Map<CompanionId, Phaser.GameObjects.Graphics> = new Map();
    private cardRects: Map<CompanionId, { x: number; y: number; w: number; h: number }> = new Map();

    constructor() {
        super(SCENE_COMPANION_SELECT);
    }

    shutdown(): void {
        this.input.off('pointerdown');
        this.cardBorders.clear();
    }

    create(): void {
        this.inventoryMgr = InventoryManager.getInstance();
        this.selectedCompanion = this.inventoryMgr.getSelectedCompanion();
        this.unlockedCompanions = [...this.inventoryMgr.getUnlockedCompanions()];
        this.cardBorders = new Map();
        this.cardRects = new Map();

        // 통계 수집
        const inventory = this.inventoryMgr.getInventory();
        const layout = this.inventoryMgr.getOnsenLayout();
        const onsenLevel = getOnsenLevel(layout.placedItems.length);
        const stats: UnlockStats = {
            maxDistance: this.inventoryMgr.getMaxDistance(),
            onsenLevelIndex: getOnsenLevelIndex(onsenLevel),
            totalItemsCollected: getTotalItems(inventory),
        };

        this.updateUnlocks(stats);

        this.cameras.main.setBackgroundColor('#E8F5E9');
        fadeIn(this);

        // 제목
        this.add.text(GAME_WIDTH / 2, 50, '동물 친구', {
            fontFamily: 'Arial', fontSize: '40px', color: '#2E7D32',
            fontStyle: 'bold', stroke: '#FFFFFF', strokeThickness: 3,
        }).setOrigin(0.5);

        // 프리뷰 영역
        this.previewGfx = this.add.graphics();
        this.drawCompanionPreview(this.selectedCompanion);

        const currentConfig = COMPANION_CONFIGS.find(c => c.id === this.selectedCompanion);
        this.previewNameText = this.add.text(GAME_WIDTH / 2, 340, currentConfig?.name ?? '없음', {
            fontFamily: 'Arial', fontSize: '28px', color: '#2E7D32', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.previewAbilityText = this.add.text(GAME_WIDTH / 2, 375, currentConfig?.abilityDescription ?? '동물 친구를 선택하세요', {
            fontFamily: 'Arial', fontSize: '18px', color: '#666666',
        }).setOrigin(0.5);

        // "없음" 카드 + 동물 카드 (총 4개, 2x2 그리드)
        const gridStartY = 440;
        const cardW = 300;
        const cardH = 130;
        const gapX = 30;
        const gapY = 20;
        const colX = [GAME_WIDTH / 2 - cardW / 2 - gapX / 2, GAME_WIDTH / 2 + cardW / 2 + gapX / 2];
        const rowY = [gridStartY, gridStartY + cardH + gapY];

        // "없음" 카드
        this.createNoneCard(colX[0], rowY[0], cardW, cardH);

        // 동물 카드
        for (let i = 0; i < COMPANION_CONFIGS.length; i++) {
            const config = COMPANION_CONFIGS[i];
            const gridIdx = i + 1; // 0 is "none"
            const col = gridIdx % 2;
            const row = Math.floor(gridIdx / 2);
            const cx = colX[col];
            const cy = rowY[row];
            this.createCompanionCard(cx, cy, cardW, cardH, config, stats);
        }

        // 뒤로가기 + 확인
        createButton(this, {
            x: GAME_WIDTH / 2 - 130, y: GAME_HEIGHT - 70,
            label: 'BACK', color: 0x757575, width: 200, height: 52, fontSize: '24px',
            callback: () => fadeToScene(this, SCENE_MAIN_MENU),
        });

        createButton(this, {
            x: GAME_WIDTH / 2 + 130, y: GAME_HEIGHT - 70,
            label: 'CONFIRM', color: 0x4CAF50, width: 200, height: 52, fontSize: '24px',
            callback: () => {
                this.inventoryMgr.saveSelectedCompanion(this.selectedCompanion);
                fadeToScene(this, SCENE_MAIN_MENU);
            },
        });
    }

    private updateUnlocks(stats: UnlockStats): void {
        let changed = false;
        for (const config of COMPANION_CONFIGS) {
            if (!this.unlockedCompanions.includes(config.id) && isCompanionUnlocked(config.unlockCondition, stats)) {
                this.unlockedCompanions.push(config.id);
                changed = true;
            }
        }
        if (changed) {
            this.inventoryMgr.saveUnlockedCompanions(this.unlockedCompanions);
        }
    }

    private drawCompanionPreview(id: CompanionId): void {
        this.previewGfx.clear();
        if (id === 'none') {
            this.previewGfx.fillStyle(0xCCCCCC, 1);
            this.previewGfx.fillCircle(GAME_WIDTH / 2, 210, 60);
            this.previewGfx.fillStyle(0x999999, 1);
            this.previewGfx.fillCircle(GAME_WIDTH / 2 - 15, 195, 8);
            this.previewGfx.fillCircle(GAME_WIDTH / 2 + 15, 195, 8);
            return;
        }

        const config = COMPANION_CONFIGS.find(c => c.id === id);
        if (!config) return;

        // 큰 원형 프리뷰
        this.previewGfx.fillStyle(config.color, 1);
        this.previewGfx.fillCircle(GAME_WIDTH / 2, 210, 60);
        // 눈
        this.previewGfx.fillStyle(0xFFFFFF, 1);
        this.previewGfx.fillCircle(GAME_WIDTH / 2 - 18, 195, 16);
        this.previewGfx.fillCircle(GAME_WIDTH / 2 + 18, 195, 16);
        this.previewGfx.fillStyle(0x000000, 1);
        this.previewGfx.fillCircle(GAME_WIDTH / 2 - 14, 195, 8);
        this.previewGfx.fillCircle(GAME_WIDTH / 2 + 22, 195, 8);
    }

    private selectCompanion(id: CompanionId, name: string, abilityDesc: string): void {
        // 이전 테두리 제거
        const prevBorder = this.cardBorders.get(this.selectedCompanion);
        if (prevBorder) prevBorder.clear();

        this.selectedCompanion = id;

        // 새 테두리
        const border = this.cardBorders.get(id);
        if (border) {
            // Border size depends on card — just redraw uniformly
            // The border was initially drawn with proper dimensions
        }

        // 프리뷰 업데이트
        this.drawCompanionPreview(id);
        this.previewNameText.setText(name);
        this.previewAbilityText.setText(abilityDesc);
    }

    private createNoneCard(x: number, y: number, w: number, h: number): void {
        const isSelected = this.selectedCompanion === 'none';

        const bg = this.add.graphics();
        bg.fillStyle(0xFFFFFF, 1);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);

        const border = this.add.graphics();
        if (isSelected) {
            border.lineStyle(4, 0x4CAF50, 1);
            border.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
        }
        this.cardBorders.set('none', border);
        this.cardRects.set('none', { x, y, w, h });

        // 아이콘
        const iconGfx = this.add.graphics();
        iconGfx.fillStyle(0xCCCCCC, 1);
        iconGfx.fillCircle(x - w / 2 + 50, y, 22);
        iconGfx.lineStyle(3, 0x999999, 1);
        iconGfx.strokeCircle(x - w / 2 + 50, y, 22);

        this.add.text(x + 10, y - 15, '없음', {
            fontFamily: 'Arial', fontSize: '20px', color: '#333333', fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.add.text(x + 10, y + 15, '동물 친구 없이 달리기', {
            fontFamily: 'Arial', fontSize: '16px', color: '#999999',
        }).setOrigin(0, 0.5);

        const hitZone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
            this.selectCompanion('none', '없음', '동물 친구를 선택하세요');
            // 테두리 갱신
            this.redrawAllBorders();
        });
    }

    private createCompanionCard(
        x: number, y: number, w: number, h: number,
        config: CompanionConfig,
        stats: UnlockStats,
    ): void {
        const isUnlocked = this.unlockedCompanions.includes(config.id);
        const isSelected = config.id === this.selectedCompanion;

        const bg = this.add.graphics();
        bg.fillStyle(isUnlocked ? 0xFFFFFF : 0xAAAAAA, 1);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);

        const border = this.add.graphics();
        if (isSelected) {
            border.lineStyle(4, 0x4CAF50, 1);
            border.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
        }
        this.cardBorders.set(config.id, border);
        this.cardRects.set(config.id, { x, y, w, h });

        // 동물 아이콘 (Graphics로 원형)
        const iconGfx = this.add.graphics();
        iconGfx.fillStyle(isUnlocked ? config.color : 0x666666, 1);
        iconGfx.fillCircle(x - w / 2 + 50, y, 22);
        // 눈
        if (isUnlocked) {
            iconGfx.fillStyle(0xFFFFFF, 1);
            iconGfx.fillCircle(x - w / 2 + 44, y - 5, 6);
            iconGfx.fillCircle(x - w / 2 + 56, y - 5, 6);
            iconGfx.fillStyle(0x000000, 1);
            iconGfx.fillCircle(x - w / 2 + 45, y - 5, 3);
            iconGfx.fillCircle(x - w / 2 + 57, y - 5, 3);
        }

        // 이름
        this.add.text(x + 10, y - 25, config.name, {
            fontFamily: 'Arial', fontSize: '20px',
            color: isUnlocked ? '#333333' : '#777777',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        // 능력/잠금 상태
        if (isUnlocked) {
            this.add.text(x + 10, y + 5, config.abilityDescription, {
                fontFamily: 'Arial', fontSize: '16px', color: '#2E7D32',
            }).setOrigin(0, 0.5);

            const statusText = isSelected ? '선택됨' : '사용 가능';
            this.add.text(x + 10, y + 28, statusText, {
                fontFamily: 'Arial', fontSize: '14px', color: '#4CAF50',
            }).setOrigin(0, 0.5);
        } else {
            this.add.text(x + 10, y + 5, config.unlockDescription, {
                fontFamily: 'Arial', fontSize: '16px', color: '#999999',
            }).setOrigin(0, 0.5);

            // 진행률 바
            const progress = getCompanionUnlockProgress(config.unlockCondition, stats);
            const barW = w - 100;
            const barH = 10;
            const barX = x - w / 2 + 80;
            const barY = y + 30;
            const barGfx = this.add.graphics();
            barGfx.fillStyle(0x555555, 1);
            barGfx.fillRoundedRect(barX, barY, barW, barH, 5);
            barGfx.fillStyle(0x4CAF50, 1);
            barGfx.fillRoundedRect(barX, barY, barW * progress, barH, 5);
            this.add.text(barX + barW + 8, barY + barH / 2, `${Math.floor(progress * 100)}%`, {
                fontFamily: 'Arial', fontSize: '12px', color: '#999999',
            }).setOrigin(0, 0.5);
        }

        // 클릭 영역
        if (isUnlocked) {
            const hitZone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
            hitZone.on('pointerdown', () => {
                this.selectCompanion(config.id, config.name, config.abilityDescription);
                this.redrawAllBorders();
            });
        }
    }

    private redrawAllBorders(): void {
        for (const [id, border] of this.cardBorders) {
            border.clear();
            if (id === this.selectedCompanion) {
                const rect = this.cardRects.get(id);
                if (rect) {
                    border.lineStyle(4, 0x4CAF50, 1);
                    border.strokeRoundedRect(rect.x - rect.w / 2, rect.y - rect.h / 2, rect.w, rect.h, 12);
                }
            }
        }
    }
}
