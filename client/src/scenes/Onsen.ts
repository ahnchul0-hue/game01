import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_ONSEN,
    SCENE_MAIN_MENU,
    ONSEN_LEVEL_COLORS,
    ONSEN_LEVEL_NAMES,
    ONSEN_ITEM_DISPLAY_SIZE,
    ONSEN_POOL_X,
    ONSEN_POOL_Y,
    ONSEN_POOL_W,
    ONSEN_POOL_H,
    ONSEN_INVENTORY_START_Y,
    LS_KEY_INVENTORY,
    type ItemType,
    type Inventory,
    type PlacedItem,
    type OnsenLayout,
} from '../utils/Constants';
import { getOnsenLevel } from '../utils/OnsenLogic';
import { InventoryManager } from '../services/InventoryManager';

const ITEM_TYPES: ItemType[] = ['mandarin', 'watermelon', 'hotspring_material'];
const ITEM_NAMES: Record<ItemType, string> = {
    mandarin: '귤',
    watermelon: '수박',
    hotspring_material: '온천 재료',
};

// Onsen pool area bounds (from Constants.ts)
const POOL_X = ONSEN_POOL_X;
const POOL_Y = ONSEN_POOL_Y;
const POOL_W = ONSEN_POOL_W;
const POOL_H = ONSEN_POOL_H;

export class Onsen extends Phaser.Scene {
    private inventoryMgr!: InventoryManager;
    private inventory!: Inventory;
    private layout!: OnsenLayout;

    // 배치 모드
    private placingType: ItemType | null = null;
    private ghostSprite: Phaser.GameObjects.Image | null = null;

    // UI elements that need refresh
    private titleText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private poolGraphics!: Phaser.GameObjects.Graphics;
    private placedSprites: Phaser.GameObjects.Image[] = [];
    private inventoryTexts: Map<ItemType, Phaser.GameObjects.Text> = new Map();

    constructor() {
        super(SCENE_ONSEN);
    }

    create(): void {
        this.inventoryMgr = InventoryManager.getInstance();
        this.inventory = this.inventoryMgr.getInventory();
        this.layout = this.inventoryMgr.getOnsenLayout();

        this.placingType = null;
        this.ghostSprite = null;
        this.placedSprites = [];
        this.inventoryTexts = new Map();

        this.cameras.main.setBackgroundColor('#D2B48C');

        this.drawAll();
    }

    private drawAll(): void {
        const level = getOnsenLevel(this.layout.placedItems.length);
        const colors = ONSEN_LEVEL_COLORS[level];
        const levelName = ONSEN_LEVEL_NAMES[level];

        // 제목
        this.titleText = this.add.text(GAME_WIDTH / 2, 50, '나의 온천', {
            fontFamily: 'Arial', fontSize: '40px', color: '#5D4037',
            fontStyle: 'bold', stroke: '#FFFFFF', strokeThickness: 3,
        }).setOrigin(0.5);

        // 레벨 표시
        this.levelText = this.add.text(GAME_WIDTH / 2, 100, `${levelName} (${this.layout.placedItems.length}개 배치)`, {
            fontFamily: 'Arial', fontSize: '22px', color: '#8B6914',
        }).setOrigin(0.5);

        // 온천 풀 영역
        this.poolGraphics = this.add.graphics();
        // 테두리
        this.poolGraphics.fillStyle(colors.rim, 1);
        this.poolGraphics.fillRoundedRect(POOL_X - 10, POOL_Y - 10, POOL_W + 20, POOL_H + 20, 30);
        // 물
        this.poolGraphics.fillStyle(colors.water, 1);
        this.poolGraphics.fillRoundedRect(POOL_X, POOL_Y, POOL_W, POOL_H, 24);
        // 김(steam) 효과 — 간단한 투명 원
        this.poolGraphics.fillStyle(0xFFFFFF, 0.15);
        this.poolGraphics.fillCircle(POOL_X + 100, POOL_Y + 30, 40);
        this.poolGraphics.fillCircle(POOL_X + 300, POOL_Y + 50, 50);
        this.poolGraphics.fillCircle(POOL_X + 420, POOL_Y + 20, 35);

        // 배치된 아이템 렌더링
        this.renderPlacedItems();

        // 온천 영역 클릭 → 배치
        const poolZone = this.add.zone(POOL_X + POOL_W / 2, POOL_Y + POOL_H / 2, POOL_W, POOL_H)
            .setInteractive({ useHandCursor: true });
        poolZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.onPoolTap(pointer.x, pointer.y);
        });

        // 구분선
        this.add.graphics().lineStyle(2, 0x8B7355, 0.5)
            .lineBetween(40, 520, GAME_WIDTH - 40, 520);

        this.add.text(GAME_WIDTH / 2, 545, '아이템을 탭하여 온천에 배치하세요', {
            fontFamily: 'Arial', fontSize: '18px', color: '#8B6914',
        }).setOrigin(0.5);

        // 인벤토리 패널
        this.renderInventoryPanel();

        // 뒤로가기 버튼
        this.createButton(GAME_WIDTH / 2, GAME_HEIGHT - 70, 'BACK', 0x757575, () => {
            this.inventoryMgr.saveOnsenLayout(this.layout);
            this.scene.start(SCENE_MAIN_MENU);
        });

        // 드래그 설정 (풀 밖으로 끌면 제거)
        this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dragX: number, dragY: number) => {
            gameObject.x = dragX;
            gameObject.y = dragY;
            // 풀 밖이면 반투명으로 제거 힌트
            const inside = dragX >= POOL_X && dragX <= POOL_X + POOL_W
                        && dragY >= POOL_Y && dragY <= POOL_Y + POOL_H;
            gameObject.setAlpha(inside ? 1 : 0.4);
        });

        this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
            const idx = this.placedSprites.indexOf(gameObject);
            if (idx < 0) return;

            const inside = gameObject.x >= POOL_X && gameObject.x <= POOL_X + POOL_W
                        && gameObject.y >= POOL_Y && gameObject.y <= POOL_Y + POOL_H;

            if (inside) {
                // 풀 안: 위치 저장
                if (this.layout.placedItems[idx]) {
                    this.layout.placedItems[idx].x = gameObject.x;
                    this.layout.placedItems[idx].y = gameObject.y;
                }
            } else {
                // 풀 밖: 아이템 제거 + 인벤토리 복구
                const removed = this.layout.placedItems.splice(idx, 1)[0];
                this.placedSprites.splice(idx, 1);
                gameObject.destroy();

                if (removed) {
                    this.inventory[removed.itemType]++;
                    localStorage.setItem(LS_KEY_INVENTORY, JSON.stringify(this.inventory));
                    const countText = this.inventoryTexts.get(removed.itemType);
                    if (countText) countText.setText(`x${this.inventory[removed.itemType]}`);
                }

                this.updateLevelDisplay();
            }

            this.inventoryMgr.saveOnsenLayout(this.layout);
        });
    }

    private renderPlacedItems(): void {
        for (const sprite of this.placedSprites) {
            sprite.destroy();
        }
        this.placedSprites = [];

        for (const item of this.layout.placedItems) {
            const sprite = this.add.image(item.x, item.y, `onsen-deco-${item.itemType}`)
                .setDisplaySize(ONSEN_ITEM_DISPLAY_SIZE * 0.8, ONSEN_ITEM_DISPLAY_SIZE * 0.8)
                .setInteractive({ draggable: true, useHandCursor: true });
            this.placedSprites.push(sprite);
        }
    }

    private renderInventoryPanel(): void {
        const startY = ONSEN_INVENTORY_START_Y;
        const spacing = GAME_WIDTH / 3;

        for (let i = 0; i < ITEM_TYPES.length; i++) {
            const itemType = ITEM_TYPES[i];
            const x = spacing / 2 + i * spacing;
            const count = this.inventory[itemType];

            // 아이콘
            const icon = this.add.image(x, startY, `onsen-deco-${itemType}`)
                .setDisplaySize(50, 50);

            // 이름
            this.add.text(x, startY + 38, ITEM_NAMES[itemType], {
                fontFamily: 'Arial', fontSize: '16px', color: '#5D4037',
            }).setOrigin(0.5);

            // 수량
            const countText = this.add.text(x, startY + 58, `x${count}`, {
                fontFamily: 'Arial', fontSize: '20px', color: '#333333', fontStyle: 'bold',
            }).setOrigin(0.5);
            this.inventoryTexts.set(itemType, countText);

            // 클릭 영역
            const hitZone = this.add.zone(x, startY + 20, 80, 90)
                .setInteractive({ useHandCursor: true });

            hitZone.on('pointerdown', () => {
                if (this.inventory[itemType] <= 0) return;
                this.startPlacing(itemType);
            });

            // hover 효과
            hitZone.on('pointerover', () => icon.setScale(1.15));
            hitZone.on('pointerout', () => icon.setScale(1));
        }
    }

    private startPlacing(itemType: ItemType): void {
        this.placingType = itemType;

        // 고스트 스프라이트 (포인터를 따라다님)
        if (this.ghostSprite) this.ghostSprite.destroy();
        this.ghostSprite = this.add.image(GAME_WIDTH / 2, POOL_Y + POOL_H / 2, `onsen-deco-${itemType}`)
            .setDisplaySize(ONSEN_ITEM_DISPLAY_SIZE * 0.8, ONSEN_ITEM_DISPLAY_SIZE * 0.8)
            .setAlpha(0.5);

        // 포인터 이동 시 고스트 추적
        this.input.on('pointermove', this.onGhostMove, this);

        // 안내 텍스트 변경
        this.titleText.setText('온천 영역을 탭하여 배치!');
    }

    private onGhostMove(pointer: Phaser.Input.Pointer): void {
        if (this.ghostSprite) {
            this.ghostSprite.x = Phaser.Math.Clamp(pointer.x, POOL_X + 20, POOL_X + POOL_W - 20);
            this.ghostSprite.y = Phaser.Math.Clamp(pointer.y, POOL_Y + 20, POOL_Y + POOL_H - 20);
        }
    }

    private onPoolTap(px: number, py: number): void {
        if (!this.placingType) return;

        const itemType = this.placingType;
        const count = this.inventory[itemType];
        if (count <= 0) {
            this.placingType = null;
            if (this.ghostSprite) { this.ghostSprite.destroy(); this.ghostSprite = null; }
            this.input.off('pointermove', this.onGhostMove, this);
            return;
        }

        // 인벤토리 차감
        this.inventory[itemType]--;
        const countText = this.inventoryTexts.get(itemType);
        if (countText) countText.setText(`x${this.inventory[itemType]}`);

        // localStorage에 인벤토리 저장 (음수 방지를 위해 직접 저장)
        localStorage.setItem(LS_KEY_INVENTORY, JSON.stringify(this.inventory));

        // 배치 정보 저장
        const placed: PlacedItem = { itemType, x: px, y: py };
        this.layout.placedItems.push(placed);
        this.inventoryMgr.saveOnsenLayout(this.layout);

        // 스프라이트 추가
        const sprite = this.add.image(px, py, `onsen-deco-${itemType}`)
            .setDisplaySize(ONSEN_ITEM_DISPLAY_SIZE * 0.8, ONSEN_ITEM_DISPLAY_SIZE * 0.8)
            .setInteractive({ draggable: true, useHandCursor: true });
        this.placedSprites.push(sprite);

        // 배치 이펙트
        sprite.setScale(0);
        this.tweens.add({
            targets: sprite,
            scaleX: ONSEN_ITEM_DISPLAY_SIZE * 0.8 / ONSEN_ITEM_DISPLAY_SIZE,
            scaleY: ONSEN_ITEM_DISPLAY_SIZE * 0.8 / ONSEN_ITEM_DISPLAY_SIZE,
            duration: 200,
            ease: 'Back.easeOut',
        });

        // 고스트 제거, 모드 해제
        this.placingType = null;
        if (this.ghostSprite) { this.ghostSprite.destroy(); this.ghostSprite = null; }
        this.input.off('pointermove', this.onGhostMove, this);
        this.titleText.setText('나의 온천');

        // 레벨 업 체크
        this.updateLevelDisplay();
    }

    private updateLevelDisplay(): void {
        const level = getOnsenLevel(this.layout.placedItems.length);
        const colors = ONSEN_LEVEL_COLORS[level];
        const levelName = ONSEN_LEVEL_NAMES[level];

        // 레벨 텍스트 업데이트
        this.levelText.setText(`${levelName} (${this.layout.placedItems.length}개 배치)`);

        // 풀 색상 업데이트
        this.poolGraphics.clear();
        this.poolGraphics.fillStyle(colors.rim, 1);
        this.poolGraphics.fillRoundedRect(POOL_X - 10, POOL_Y - 10, POOL_W + 20, POOL_H + 20, 30);
        this.poolGraphics.fillStyle(colors.water, 1);
        this.poolGraphics.fillRoundedRect(POOL_X, POOL_Y, POOL_W, POOL_H, 24);
        this.poolGraphics.fillStyle(0xFFFFFF, 0.15);
        this.poolGraphics.fillCircle(POOL_X + 100, POOL_Y + 30, 40);
        this.poolGraphics.fillCircle(POOL_X + 300, POOL_Y + 50, 50);
        this.poolGraphics.fillCircle(POOL_X + 420, POOL_Y + 20, 35);
    }

    private createButton(
        x: number, y: number, label: string, color: number, callback: () => void,
    ): void {
        const btnW = 240;
        const btnH = 56;

        const bg = this.add.graphics();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 14);

        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial', fontSize: '26px', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);

        const hitArea = this.add.zone(x, y, btnW, btnH).setInteractive({ useHandCursor: true });

        hitArea.on('pointerdown', () => {
            bg.setAlpha(0.7);
            text.setAlpha(0.7);
            this.time.delayedCall(120, () => {
                bg.setAlpha(1);
                text.setAlpha(1);
                callback();
            });
        });
    }
}
