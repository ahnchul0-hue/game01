import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_SKIN_SELECT,
    SCENE_MAIN_MENU,
    SKIN_CONFIGS,
    type SkinId,
    type SkinConfig,
} from '../utils/Constants';
import { isSkinUnlocked, getUnlockProgress, getOnsenLevelIndex, getTotalItems, getOnsenLevel, type UnlockStats } from '../utils/OnsenLogic';
import { InventoryManager } from '../services/InventoryManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';
import { ensureSkinTexture } from '../utils/TextureUtils';

export class SkinSelect extends Phaser.Scene {
    private inventoryMgr!: InventoryManager;
    private selectedSkin!: SkinId;
    private unlockedSkins!: SkinId[];
    private previewImage!: Phaser.GameObjects.Image;
    private cardBorders: Map<SkinId, Phaser.GameObjects.Graphics> = new Map();

    constructor() {
        super(SCENE_SKIN_SELECT);
    }

    shutdown(): void {
        this.cardBorders.clear();
    }

    create(): void {
        // lazy 스킨 텍스처 생성 (필요 시점에 CPU로 생성)
        for (const skin of SKIN_CONFIGS) {
            ensureSkinTexture(this, skin.id);
        }

        this.inventoryMgr = InventoryManager.getInstance();
        this.selectedSkin = this.inventoryMgr.getSelectedSkin();
        this.unlockedSkins = [...this.inventoryMgr.getUnlockedSkins()];
        this.cardBorders = new Map();

        // 잠금해제 상태 체크를 위한 통계 수집
        const inventory = this.inventoryMgr.getInventory();
        const layout = this.inventoryMgr.getOnsenLayout();
        const onsenLevel = getOnsenLevel(layout.placedItems.length);
        const stats: UnlockStats = {
            maxDistance: this.inventoryMgr.getMaxDistance(),
            onsenLevelIndex: getOnsenLevelIndex(onsenLevel),
            totalItemsCollected: getTotalItems(inventory),
        };

        // 새로 잠금해제된 스킨 갱신
        this.updateUnlocks(stats);

        this.cameras.main.setBackgroundColor('#87CEEB');

        // 페이드인
        fadeIn(this);

        // 제목
        this.add.text(GAME_WIDTH / 2, 50, '스킨 선택', {
            fontFamily: 'Arial', fontSize: '40px', color: '#5D4037',
            fontStyle: 'bold', stroke: '#FFFFFF', strokeThickness: 3,
        }).setOrigin(0.5);

        // 프리뷰
        this.previewImage = this.add.image(GAME_WIDTH / 2, 220, `capybara-${this.selectedSkin}`)
            .setScale(2);

        const previewName = SKIN_CONFIGS.find(s => s.id === this.selectedSkin)?.name ?? '';
        const previewText = this.add.text(GAME_WIDTH / 2, 360, previewName, {
            fontFamily: 'Arial', fontSize: '24px', color: '#5D4037', fontStyle: 'bold',
        }).setOrigin(0.5);

        // 2×2 그리드
        const gridStartY = 460;
        const cardW = 300;
        const cardH = 140;
        const gapX = 30;
        const gapY = 20;
        const colX = [GAME_WIDTH / 2 - cardW / 2 - gapX / 2, GAME_WIDTH / 2 + cardW / 2 + gapX / 2];
        const rowY = [gridStartY, gridStartY + cardH + gapY];

        for (let i = 0; i < SKIN_CONFIGS.length; i++) {
            const config = SKIN_CONFIGS[i];
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx = colX[col];
            const cy = rowY[row];

            this.createSkinCard(cx, cy, cardW, cardH, config, previewText, stats);
        }

        // 뒤로가기 + 확인 (한 줄로)
        createButton(this, {
            x: GAME_WIDTH / 2 - 130, y: GAME_HEIGHT - 70,
            label: 'BACK', color: 0x757575, width: 200, height: 52, fontSize: '24px',
            callback: () => fadeToScene(this, SCENE_MAIN_MENU),
        });

        createButton(this, {
            x: GAME_WIDTH / 2 + 130, y: GAME_HEIGHT - 70,
            label: 'CONFIRM', color: 0x4CAF50, width: 200, height: 52, fontSize: '24px',
            callback: () => {
                this.inventoryMgr.saveSelectedSkin(this.selectedSkin);
                fadeToScene(this, SCENE_MAIN_MENU);
            },
        });
    }

    private updateUnlocks(stats: UnlockStats): void {
        let changed = false;
        for (const config of SKIN_CONFIGS) {
            if (!this.unlockedSkins.includes(config.id) && isSkinUnlocked(config.unlockCondition, stats)) {
                this.unlockedSkins.push(config.id);
                changed = true;
            }
        }
        if (changed) {
            this.inventoryMgr.saveUnlockedSkins(this.unlockedSkins);
        }
    }

    private createSkinCard(
        x: number, y: number, w: number, h: number,
        config: SkinConfig,
        previewText: Phaser.GameObjects.Text,
        stats: UnlockStats,
    ): void {
        const isUnlocked = this.unlockedSkins.includes(config.id);
        const isSelected = config.id === this.selectedSkin;

        // 카드 배경
        const bg = this.add.graphics();
        bg.fillStyle(isUnlocked ? 0xFFFFFF : 0xAAAAAA, 1);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);

        // 선택 테두리
        const border = this.add.graphics();
        if (isSelected) {
            border.lineStyle(4, 0x4CAF50, 1);
            border.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
        }
        this.cardBorders.set(config.id, border);

        // 캐릭터 미니 프리뷰
        const icon = this.add.image(x - w / 2 + 50, y, `capybara-${config.id}`)
            .setScale(0.6);

        if (!isUnlocked) {
            icon.setTint(0x555555);
        }

        // 이름
        this.add.text(x + 10, y - 25, config.name, {
            fontFamily: 'Arial', fontSize: '20px',
            color: isUnlocked ? '#333333' : '#777777',
            fontStyle: 'bold',
        }).setOrigin(0, 0.5);

        // 잠금 조건 / 상태
        const statusText = isUnlocked
            ? (isSelected ? '선택됨' : '사용 가능')
            : config.unlockDescription;
        const statusColor = isUnlocked ? '#4CAF50' : '#999999';

        this.add.text(x + 10, y + 15, statusText, {
            fontFamily: 'Arial', fontSize: '16px', color: statusColor,
        }).setOrigin(0, 0.5);

        // 잠금 아이콘 + 진행률 바
        if (!isUnlocked) {
            const lockGfx = this.add.graphics();
            lockGfx.fillStyle(0x666666, 1);
            lockGfx.fillRoundedRect(x + w / 2 - 42, y - h / 2 + 6, 18, 14, 3);
            lockGfx.lineStyle(2, 0x666666, 1);
            lockGfx.strokeCircle(x + w / 2 - 33, y - h / 2 + 6, 7);

            // 진행률 바
            const progress = getUnlockProgress(config.unlockCondition, stats);
            const barW = w - 100;
            const barH = 10;
            const barX = x - w / 2 + 80;
            const barY = y + 35;
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
                // 이전 선택 테두리 제거
                const prevBorder = this.cardBorders.get(this.selectedSkin);
                if (prevBorder) prevBorder.clear();

                this.selectedSkin = config.id;

                // 새 테두리
                border.clear();
                border.lineStyle(4, 0x4CAF50, 1);
                border.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);

                // 프리뷰 업데이트
                this.previewImage.setTexture(`capybara-${config.id}`);
                previewText.setText(config.name);
            });
        }
    }

}
