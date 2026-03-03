import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_COMPANION_SELECT,
    SCENE_MAIN_MENU,
    COMPANION_CONFIGS,
    FONT_FAMILY,
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
            fontFamily: FONT_FAMILY, fontSize: '40px', color: '#2E7D32',
            fontStyle: 'bold', stroke: '#FFFFFF', strokeThickness: 3,
        }).setOrigin(0.5);

        // 프리뷰 영역
        this.previewGfx = this.add.graphics();
        this.drawCompanionPreview(this.selectedCompanion);

        const currentConfig = COMPANION_CONFIGS.find(c => c.id === this.selectedCompanion);
        this.previewNameText = this.add.text(GAME_WIDTH / 2, 340, currentConfig?.name ?? '없음', {
            fontFamily: FONT_FAMILY, fontSize: '28px', color: '#2E7D32', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.previewAbilityText = this.add.text(GAME_WIDTH / 2, 375, currentConfig?.abilityDescription ?? '동물 친구를 선택하세요', {
            fontFamily: FONT_FAMILY, fontSize: '18px', color: '#666666',
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
        const g = this.previewGfx;
        g.clear();
        const cx = GAME_WIDTH / 2;
        const cy = 210;

        if (id === 'none') {
            g.fillStyle(0xCCCCCC, 1);
            g.fillCircle(cx, cy, 60);
            g.fillStyle(0x999999, 1);
            g.fillCircle(cx - 15, cy - 15, 8);
            g.fillCircle(cx + 15, cy - 15, 8);
            // 물음표
            g.fillStyle(0xAAAAAA, 1);
            g.fillRoundedRect(cx - 8, cy + 8, 16, 20, 4);
            return;
        }

        const config = COMPANION_CONFIGS.find(c => c.id === id);
        if (!config) return;

        // 배경 글로우
        g.fillStyle(config.color, 0.15);
        g.fillCircle(cx, cy, 72);

        if (id === 'otter') {
            // 수달: 길쭉한 몸 + 둥근 머리 + 수염
            g.fillStyle(config.color, 1);
            g.fillEllipse(cx, cy + 20, 60, 80); // 몸
            g.fillCircle(cx, cy - 30, 32); // 머리
            g.fillStyle(0x8B6B47, 1);
            g.fillEllipse(cx, cy + 10, 40, 50); // 배
            // 귀
            g.fillStyle(config.color, 1);
            g.fillCircle(cx - 25, cy - 48, 10);
            g.fillCircle(cx + 25, cy - 48, 10);
            // 눈
            g.fillStyle(0xFFFFFF, 1);
            g.fillCircle(cx - 12, cy - 35, 10);
            g.fillCircle(cx + 12, cy - 35, 10);
            g.fillStyle(0x000000, 1);
            g.fillCircle(cx - 10, cy - 35, 5);
            g.fillCircle(cx + 14, cy - 35, 5);
            // 코
            g.fillStyle(0x333333, 1);
            g.fillCircle(cx, cy - 22, 5);
            // 수염
            g.lineStyle(1.5, 0x333333, 0.6);
            g.lineBetween(cx - 8, cy - 20, cx - 28, cy - 24);
            g.lineBetween(cx - 8, cy - 18, cx - 26, cy - 16);
            g.lineBetween(cx + 8, cy - 20, cx + 28, cy - 24);
            g.lineBetween(cx + 8, cy - 18, cx + 26, cy - 16);
        } else if (id === 'duck') {
            // 오리: 둥근 몸 + 부리 + 날개
            g.fillStyle(config.color, 1);
            g.fillEllipse(cx, cy + 10, 80, 70); // 몸
            g.fillCircle(cx, cy - 28, 28); // 머리
            // 날개
            g.fillStyle(0xE6C200, 1);
            g.fillEllipse(cx - 38, cy + 5, 25, 40);
            g.fillEllipse(cx + 38, cy + 5, 25, 40);
            // 부리
            g.fillStyle(0xFF8C00, 1);
            g.beginPath();
            g.moveTo(cx - 6, cy - 20);
            g.lineTo(cx + 6, cy - 20);
            g.lineTo(cx + 10, cy - 12);
            g.lineTo(cx - 10, cy - 12);
            g.closePath();
            g.fillPath();
            // 눈
            g.fillStyle(0x000000, 1);
            g.fillCircle(cx - 10, cy - 32, 5);
            g.fillCircle(cx + 10, cy - 32, 5);
            // 하이라이트
            g.fillStyle(0xFFFFFF, 0.4);
            g.fillCircle(cx - 8, cy - 34, 2);
            g.fillCircle(cx + 12, cy - 34, 2);
        } else if (id === 'turtle') {
            // 거북이: 등딱지 + 머리 + 다리
            // 등딱지
            g.fillStyle(config.color, 1);
            g.fillEllipse(cx, cy + 5, 90, 70);
            // 등딱지 무늬
            g.lineStyle(2, 0x1B6B3A, 0.5);
            g.strokeCircle(cx, cy + 5, 20);
            g.lineBetween(cx - 20, cy + 5, cx - 40, cy + 5);
            g.lineBetween(cx + 20, cy + 5, cx + 40, cy + 5);
            g.lineBetween(cx, cy - 15, cx, cy - 30);
            g.lineBetween(cx, cy + 25, cx, cy + 40);
            // 머리
            g.fillStyle(0x3CB371, 1);
            g.fillCircle(cx, cy - 38, 18);
            // 다리
            g.fillEllipse(cx - 35, cy + 35, 16, 22);
            g.fillEllipse(cx + 35, cy + 35, 16, 22);
            g.fillEllipse(cx - 30, cy - 20, 14, 18);
            g.fillEllipse(cx + 30, cy - 20, 14, 18);
            // 눈
            g.fillStyle(0xFFFFFF, 1);
            g.fillCircle(cx - 8, cy - 42, 7);
            g.fillCircle(cx + 8, cy - 42, 7);
            g.fillStyle(0x000000, 1);
            g.fillCircle(cx - 6, cy - 42, 3);
            g.fillCircle(cx + 10, cy - 42, 3);
            // 미소
            g.lineStyle(2, 0x000000, 0.5);
            g.arc(cx, cy - 32, 6, 0, Math.PI);
            g.strokePath();
        }
    }

    private selectCompanion(id: CompanionId, name: string, abilityDesc: string): void {
        this.selectedCompanion = id;
        this.redrawAllBorders();

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
            fontFamily: FONT_FAMILY, fontSize: '20px', color: '#333333', fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        this.add.text(x + 10, y + 15, '동물 친구 없이 달리기', {
            fontFamily: FONT_FAMILY, fontSize: '16px', color: '#999999',
        }).setOrigin(0, 0.5);

        const hitZone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
            this.selectCompanion('none', '없음', '동물 친구를 선택하세요');
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

        // 동물 아이콘 (특징적 미니 실루엣)
        const iconGfx = this.add.graphics();
        const ix = x - w / 2 + 50;
        const iy = y;
        const col = isUnlocked ? config.color : 0x666666;
        iconGfx.fillStyle(col, 1);
        iconGfx.fillCircle(ix, iy, 22); // 몸
        if (isUnlocked) {
            // 눈
            iconGfx.fillStyle(0xFFFFFF, 1);
            iconGfx.fillCircle(ix - 7, iy - 5, 6);
            iconGfx.fillCircle(ix + 7, iy - 5, 6);
            iconGfx.fillStyle(0x000000, 1);
            iconGfx.fillCircle(ix - 5, iy - 5, 3);
            iconGfx.fillCircle(ix + 9, iy - 5, 3);
            // 동물별 특징
            if (config.id === 'otter') {
                // 수달 수염
                iconGfx.lineStyle(1, 0x333333, 0.6);
                iconGfx.lineBetween(ix - 5, iy + 3, ix - 18, iy);
                iconGfx.lineBetween(ix + 5, iy + 3, ix + 18, iy);
            } else if (config.id === 'duck') {
                // 오리 부리
                iconGfx.fillStyle(0xFF8C00, 1);
                iconGfx.fillRoundedRect(ix - 6, iy + 4, 12, 8, 3);
            } else if (config.id === 'turtle') {
                // 거북이 등딱지 무늬
                iconGfx.lineStyle(1.5, 0x1B6B3A, 0.5);
                iconGfx.strokeCircle(ix, iy, 10);
            }
        }

        // 이름
        this.add.text(x + 10, y - 25, config.name, {
            fontFamily: FONT_FAMILY, fontSize: '20px',
            color: isUnlocked ? '#333333' : '#777777',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        // 능력/잠금 상태
        if (isUnlocked) {
            this.add.text(x + 10, y + 5, config.abilityDescription, {
                fontFamily: FONT_FAMILY, fontSize: '16px', color: '#2E7D32',
            }).setOrigin(0, 0.5);

            const statusText = isSelected ? '선택됨' : '사용 가능';
            this.add.text(x + 10, y + 28, statusText, {
                fontFamily: FONT_FAMILY, fontSize: '14px', color: '#4CAF50',
            }).setOrigin(0, 0.5);
        } else {
            this.add.text(x + 10, y + 5, config.unlockDescription, {
                fontFamily: FONT_FAMILY, fontSize: '16px', color: '#999999',
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
                fontFamily: FONT_FAMILY, fontSize: '12px', color: '#999999',
            }).setOrigin(0, 0.5);
        }

        // 클릭 영역
        if (isUnlocked) {
            const hitZone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
            hitZone.on('pointerdown', () => {
                this.selectCompanion(config.id, config.name, config.abilityDescription);
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
