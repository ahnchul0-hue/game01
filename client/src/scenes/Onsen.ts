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
    FONT_FAMILY,
    COMPANION_CONFIGS,
    type ItemType,
    type Inventory,
    type PlacedItem,
    type OnsenLayout,
    type CompanionId,
} from '../utils/Constants';
import { getOnsenLevel } from '../utils/OnsenLogic';
import { InventoryManager } from '../services/InventoryManager';
import { SoundManager } from '../services/SoundManager';
import { createButton, fadeToScene, fadeIn, type ButtonHandle } from '../ui/UIFactory';
import { ATLAS_UI_KEY } from '../utils/TextureAtlasBuilder';

/** 온천 씬 동물 친구 배치 위치 (온천 풀 내부 절대 좌표) */
const COMPANION_POSITIONS: Record<Exclude<CompanionId, 'none'>, { x: number; y: number }> = {
    otter:  { x: ONSEN_POOL_X + 100, y: 440 },
    duck:   { x: ONSEN_POOL_X + 200, y: 460 },
    turtle: { x: ONSEN_POOL_X + 300, y: 450 },
};

const ITEM_TYPES: ItemType[] = ['mandarin', 'watermelon', 'hotspring_material'];
const ITEM_NAMES: Record<ItemType, string> = {
    mandarin: '귤',
    watermelon: '수박',
    hotspring_material: '온천 재료',
};

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
    private steamEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

    // 공유 버튼 핸들 (스크린샷 캡처 시 일시적으로 숨김)
    private shareButtonHandle: ButtonHandle | null = null;

    // 온천 동물 친구
    private companionGraphics: Phaser.GameObjects.Graphics[] = [];

    constructor() {
        super(SCENE_ONSEN);
    }

    shutdown(): void {
        this.cleanupPlacingMode();
        if (this.steamEmitter) {
            this.steamEmitter.stop();
            this.steamEmitter.destroy();
            this.steamEmitter = null;
        }
        this.tweens.killAll();
        this.time.removeAllEvents();
        this.input.off('drag', this.onDrag, this);
        this.input.off('dragend', this.onDragEnd, this);
        this.placedSprites = [];
        this.inventoryTexts.clear();
        // 동물 친구 Graphics 정리
        for (const gfx of this.companionGraphics) {
            gfx.destroy();
        }
        this.companionGraphics = [];
    }

    create(): void {
        this.inventoryMgr = InventoryManager.getInstance();
        this.inventory = this.inventoryMgr.getInventory();
        this.layout = this.inventoryMgr.getOnsenLayout();

        this.placingType = null;
        this.ghostSprite = null;
        this.placedSprites = [];
        this.inventoryTexts = new Map();
        this.companionGraphics = [];

        this.cameras.main.setBackgroundColor('#D2B48C');

        // 페이드인
        fadeIn(this);

        // 온천 BGM
        SoundManager.getInstance().playBgm('bgm-onsen');

        this.drawAll();
    }

    private drawAll(): void {
        const level = getOnsenLevel(this.layout.placedItems.length);
        const colors = ONSEN_LEVEL_COLORS[level];
        const levelName = ONSEN_LEVEL_NAMES[level];

        // 제목
        this.titleText = this.add.text(GAME_WIDTH / 2, 50, '나의 온천', {
            fontFamily: FONT_FAMILY, fontSize: '40px', color: '#5D4037',
            fontStyle: 'bold', stroke: '#FFFFFF', strokeThickness: 3,
        }).setOrigin(0.5);

        // 레벨 표시
        this.levelText = this.add.text(GAME_WIDTH / 2, 100, `${levelName} (${this.layout.placedItems.length}개 배치)`, {
            fontFamily: FONT_FAMILY, fontSize: '22px', color: '#8B6914',
        }).setOrigin(0.5);

        // 온천 풀 영역
        this.poolGraphics = this.add.graphics();
        // 테두리
        this.poolGraphics.fillStyle(colors.rim, 1);
        this.poolGraphics.fillRoundedRect(ONSEN_POOL_X - 10, ONSEN_POOL_Y - 10, ONSEN_POOL_W + 20, ONSEN_POOL_H + 20, 30);
        // 물
        this.poolGraphics.fillStyle(colors.water, 1);
        this.poolGraphics.fillRoundedRect(ONSEN_POOL_X, ONSEN_POOL_Y, ONSEN_POOL_W, ONSEN_POOL_H, 24);
        // 물결 웨이브 애니메이션 (3개 반투명 타원이 좌우 이동)
        for (let i = 0; i < 3; i++) {
            const waveGfx = this.add.graphics().setDepth(2);
            waveGfx.fillStyle(0xFFFFFF, 0.12);
            const waveW = 80 + i * 30;
            const waveH = 16 + i * 4;
            waveGfx.fillEllipse(ONSEN_POOL_X + 80 + i * 160, ONSEN_POOL_Y + 30 + i * 25, waveW, waveH);
            this.tweens.add({
                targets: waveGfx,
                x: { from: -15, to: 15 },
                alpha: { from: 0.7, to: 1 },
                duration: 2500 + i * 500,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });
        }

        // 온천 김(steam) 파티클
        this.steamEmitter = this.add.particles(ONSEN_POOL_X + ONSEN_POOL_W / 2, ONSEN_POOL_Y + 20, ATLAS_UI_KEY, {
            frame: 'particle',
            x: { min: -ONSEN_POOL_W / 3, max: ONSEN_POOL_W / 3 },
            speedY: { min: -30, max: -15 },
            speedX: { min: -5, max: 5 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.25, end: 0 },
            lifespan: { min: 1500, max: 2500 },
            frequency: 200,
            tint: 0xFFFFFF,
        }).setDepth(5);

        // 카피바라 목욕 스프라이트 (풀 중앙)
        const selectedSkin = this.inventoryMgr.getSelectedSkin();
        const bathCapy = this.add.image(
            ONSEN_POOL_X + ONSEN_POOL_W / 2,
            ONSEN_POOL_Y + ONSEN_POOL_H / 2 + 20,
            `capybara-${selectedSkin}`,
        ).setScale(1.2).setDepth(3);
        // 반쯤 물에 잠긴 효과 — crop 대신 alpha mask
        bathCapy.setCrop(0, 0, 100, 85);
        // 물에서 살짝 흔들리는 애니메이션
        this.tweens.add({
            targets: bathCapy,
            y: bathCapy.y - 3,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });

        // 배치된 아이템 렌더링
        this.renderPlacedItems();

        // 해금된 동물 친구 온천 배치
        this.renderOnsenCompanions();

        // 온천 영역 클릭 → 배치
        const poolZone = this.add.zone(ONSEN_POOL_X + ONSEN_POOL_W / 2, ONSEN_POOL_Y + ONSEN_POOL_H / 2, ONSEN_POOL_W, ONSEN_POOL_H)
            .setInteractive({ useHandCursor: true });
        poolZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.onPoolTap(pointer.x, pointer.y);
        });

        // 구분선
        this.add.graphics().lineStyle(2, 0x8B7355, 0.5)
            .lineBetween(40, 520, GAME_WIDTH - 40, 520);

        this.add.text(GAME_WIDTH / 2, 545, '아이템을 탭하여 온천에 배치하세요', {
            fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8B6914',
        }).setOrigin(0.5);

        // 인벤토리 패널
        this.renderInventoryPanel();

        // 뒤로가기 버튼 (좌측)
        createButton(this, {
            x: GAME_WIDTH / 2 - 130, y: GAME_HEIGHT - 70,
            label: 'BACK', color: 0x757575,
            width: 220,
            callback: () => {
                this.cleanupPlacingMode();
                this.inventoryMgr.saveOnsenLayout(this.layout);
                fadeToScene(this, SCENE_MAIN_MENU);
            },
        });

        // 스크린샷 공유 버튼 (우측)
        this.shareButtonHandle = createButton(this, {
            x: GAME_WIDTH / 2 + 130, y: GAME_HEIGHT - 70,
            label: '📸 Share', color: 0x1565C0,
            width: 220,
            callback: () => {
                this.captureAndShare();
            },
        });

        // 드래그 설정 (풀 밖으로 끌면 제거) — named 참조로 안전한 해제
        this.input.on('drag', this.onDrag, this);
        this.input.on('dragend', this.onDragEnd, this);
    }

    private onDrag(_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dragX: number, dragY: number): void {
        gameObject.x = dragX;
        gameObject.y = dragY;
        // 풀 밖이면 반투명으로 제거 힌트
        const inside = dragX >= ONSEN_POOL_X && dragX <= ONSEN_POOL_X + ONSEN_POOL_W
                    && dragY >= ONSEN_POOL_Y && dragY <= ONSEN_POOL_Y + ONSEN_POOL_H;
        gameObject.setAlpha(inside ? 1 : 0.4);
    }

    private onDragEnd(_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image): void {
        const idx = this.placedSprites.indexOf(gameObject);
        if (idx < 0) return;

        const inside = gameObject.x >= ONSEN_POOL_X && gameObject.x <= ONSEN_POOL_X + ONSEN_POOL_W
                    && gameObject.y >= ONSEN_POOL_Y && gameObject.y <= ONSEN_POOL_Y + ONSEN_POOL_H;

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
                this.inventoryMgr.saveInventory(this.inventory);
                const countText = this.inventoryTexts.get(removed.itemType);
                if (countText) countText.setText(`x${this.inventory[removed.itemType]}`);
            }

            this.updateLevelDisplay();
        }

        this.inventoryMgr.saveOnsenLayout(this.layout);
    }

    private renderPlacedItems(): void {
        for (const sprite of this.placedSprites) {
            sprite.destroy();
        }
        this.placedSprites = [];

        for (const item of this.layout.placedItems) {
            const sprite = this.add.image(item.x, item.y, ATLAS_UI_KEY, `onsen-deco-${item.itemType}`)
                .setDisplaySize(ONSEN_ITEM_DISPLAY_SIZE * 0.8, ONSEN_ITEM_DISPLAY_SIZE * 0.8)
                .setInteractive({ draggable: true, useHandCursor: true });
            this.placedSprites.push(sprite);
        }
    }

    /**
     * G1: 해금된 동물 친구를 온천 물속에 배치합니다.
     * COMPANION_CONFIGS 의 각 동물을 COMPANION_POSITIONS 위치에 프로시저럴 그래픽으로 그리고
     * Sine 커브 위아래 부유 idle 애니메이션을 적용합니다.
     * CompanionSelect.ts 의 drawCompanionPreview() 방식을 참조하여 구현했습니다.
     */
    private renderOnsenCompanions(): void {
        // 기존 Graphics 정리 (씬 재진입 방지)
        for (const gfx of this.companionGraphics) {
            gfx.destroy();
        }
        this.companionGraphics = [];

        const unlocked = this.inventoryMgr.getUnlockedCompanions();

        for (const config of COMPANION_CONFIGS) {
            if (!unlocked.includes(config.id)) continue;

            const pos = COMPANION_POSITIONS[config.id as Exclude<CompanionId, 'none'>];
            if (!pos) continue;

            // 동물 그래픽 — 물 레이어(depth 2) 위, 카피바라(depth 3)와 같은 층에 배치
            const gfx = this.add.graphics().setDepth(4);
            this.companionGraphics.push(gfx);

            // 동물별 프로시저럴 그래픽 (물에 반쯤 잠긴 모습)
            this.drawCompanionInOnsen(gfx, config.id as Exclude<CompanionId, 'none'>, pos.x, pos.y, config.color);

            // idle 애니메이션: 위아래 부유 (동물마다 위상 차이로 자연스러운 움직임)
            const phaseOffset = COMPANION_CONFIGS.indexOf(config) * 600;
            this.tweens.add({
                targets: gfx,
                y: { from: 0, to: -6 },
                duration: 1800 + phaseOffset,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });

            // 동물 이름 레이블 (동물 위쪽에 표시)
            const nameText = this.add.text(pos.x, pos.y - 42, config.name, {
                fontFamily: FONT_FAMILY,
                fontSize: '14px',
                color: '#FFFFFF',
                stroke: '#333333',
                strokeThickness: 3,
            }).setOrigin(0.5).setDepth(4).setAlpha(0.9);

            // 이름 레이블도 동물과 함께 부유
            this.tweens.add({
                targets: nameText,
                y: { from: pos.y - 42, to: pos.y - 48 },
                duration: 1800 + phaseOffset,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });
        }
    }

    /**
     * Graphics 객체에 동물 친구를 온천 물 속 모습으로 그립니다.
     * 상반신만 표시되고 하반신은 물에 잠긴 것처럼 반투명 타원으로 처리합니다.
     */
    private drawCompanionInOnsen(
        g: Phaser.GameObjects.Graphics,
        id: Exclude<CompanionId, 'none'>,
        cx: number,
        cy: number,
        color: number,
    ): void {
        // 동물 주변 물 수면 리플 (반원형 물결 표현)
        g.lineStyle(1.5, 0xFFFFFF, 0.45);
        g.strokeEllipse(cx, cy + 6, 54, 14);

        if (id === 'otter') {
            this.drawOtterInOnsen(g, cx, cy, color);
        } else if (id === 'duck') {
            this.drawDuckInOnsen(g, cx, cy, color);
        } else if (id === 'turtle') {
            this.drawTurtleInOnsen(g, cx, cy, color);
        }
    }

    /** 수달 — 물에 반쯤 잠긴 모습 (머리 + 상체만, 하체는 물 표현) */
    private drawOtterInOnsen(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number): void {
        // 상체
        g.fillStyle(color, 1);
        g.fillEllipse(cx, cy + 8, 34, 28);
        // 배 (밝은 갈색)
        g.fillStyle(0xC49A6C, 1);
        g.fillEllipse(cx, cy + 10, 20, 18);
        // 머리
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy - 12, 18);
        // 귀
        g.fillCircle(cx - 14, cy - 26, 6);
        g.fillCircle(cx + 14, cy - 26, 6);
        // 눈 흰자
        g.fillStyle(0xFFFFFF, 1);
        g.fillCircle(cx - 7, cy - 16, 6);
        g.fillCircle(cx + 7, cy - 16, 6);
        // 눈동자
        g.fillStyle(0x000000, 1);
        g.fillCircle(cx - 5, cy - 16, 3);
        g.fillCircle(cx + 9, cy - 16, 3);
        // 코
        g.fillStyle(0x333333, 1);
        g.fillCircle(cx, cy - 5, 3);
        // 수염
        g.lineStyle(1.2, 0x555555, 0.7);
        g.lineBetween(cx - 5, cy - 4, cx - 18, cy - 7);
        g.lineBetween(cx - 5, cy - 2, cx - 16, cy - 1);
        g.lineBetween(cx + 5, cy - 4, cx + 18, cy - 7);
        g.lineBetween(cx + 5, cy - 2, cx + 16, cy - 1);
        // 물에 잠긴 하체 표현 (반투명 파란 타원)
        g.fillStyle(0x87CEEB, 0.35);
        g.fillEllipse(cx, cy + 18, 38, 16);
    }

    /** 오리 — 물에 반쯤 잠긴 모습 (몸통 + 머리) */
    private drawDuckInOnsen(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number): void {
        // 몸통
        g.fillStyle(color, 1);
        g.fillEllipse(cx, cy + 6, 44, 28);
        // 날개 힌트
        g.fillStyle(0xDAB800, 1);
        g.fillEllipse(cx - 20, cy + 4, 12, 20);
        g.fillEllipse(cx + 20, cy + 4, 12, 20);
        // 머리
        g.fillStyle(color, 1);
        g.fillCircle(cx, cy - 14, 16);
        // 부리
        g.fillStyle(0xFF8C00, 1);
        g.beginPath();
        g.moveTo(cx - 5, cy - 8);
        g.lineTo(cx + 5, cy - 8);
        g.lineTo(cx + 8, cy - 2);
        g.lineTo(cx - 8, cy - 2);
        g.closePath();
        g.fillPath();
        // 눈
        g.fillStyle(0x000000, 1);
        g.fillCircle(cx - 6, cy - 18, 4);
        g.fillCircle(cx + 6, cy - 18, 4);
        // 눈 하이라이트
        g.fillStyle(0xFFFFFF, 0.6);
        g.fillCircle(cx - 5, cy - 19, 1.5);
        g.fillCircle(cx + 7, cy - 19, 1.5);
        // 물에 잠긴 하체 표현
        g.fillStyle(0x87CEEB, 0.35);
        g.fillEllipse(cx, cy + 16, 48, 14);
    }

    /** 거북이 — 물에 반쯤 잠긴 모습 (등딱지 + 머리 + 앞다리) */
    private drawTurtleInOnsen(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number): void {
        // 등딱지
        g.fillStyle(color, 1);
        g.fillEllipse(cx, cy + 4, 52, 36);
        // 등딱지 무늬
        g.lineStyle(1.5, 0x1B6B3A, 0.5);
        g.strokeCircle(cx, cy + 4, 12);
        g.lineBetween(cx - 12, cy + 4, cx - 24, cy + 4);
        g.lineBetween(cx + 12, cy + 4, cx + 24, cy + 4);
        g.lineBetween(cx, cy - 8, cx, cy - 18);
        // 앞다리 (물 밖으로 살짝)
        g.fillStyle(0x3CB371, 1);
        g.fillEllipse(cx - 24, cy - 4, 10, 14);
        g.fillEllipse(cx + 24, cy - 4, 10, 14);
        // 머리
        g.fillStyle(0x3CB371, 1);
        g.fillCircle(cx, cy - 20, 12);
        // 눈
        g.fillStyle(0xFFFFFF, 1);
        g.fillCircle(cx - 5, cy - 24, 5);
        g.fillCircle(cx + 5, cy - 24, 5);
        g.fillStyle(0x000000, 1);
        g.fillCircle(cx - 3, cy - 24, 2.5);
        g.fillCircle(cx + 7, cy - 24, 2.5);
        // 미소
        g.lineStyle(1.5, 0x000000, 0.5);
        g.arc(cx, cy - 14, 4, 0, Math.PI);
        g.strokePath();
        // 물에 잠긴 하체 표현
        g.fillStyle(0x87CEEB, 0.35);
        g.fillEllipse(cx, cy + 14, 56, 14);
    }

    private renderInventoryPanel(): void {
        const startY = ONSEN_INVENTORY_START_Y;
        const spacing = GAME_WIDTH / 3;

        for (let i = 0; i < ITEM_TYPES.length; i++) {
            const itemType = ITEM_TYPES[i];
            const x = spacing / 2 + i * spacing;
            const count = this.inventory[itemType];

            // 아이콘
            const icon = this.add.image(x, startY, ATLAS_UI_KEY, `onsen-deco-${itemType}`)
                .setDisplaySize(50, 50);

            // 이름
            this.add.text(x, startY + 38, ITEM_NAMES[itemType], {
                fontFamily: FONT_FAMILY, fontSize: '16px', color: '#5D4037',
            }).setOrigin(0.5);

            // 수량
            const countText = this.add.text(x, startY + 58, `x${count}`, {
                fontFamily: FONT_FAMILY, fontSize: '20px', color: '#333333', fontStyle: 'bold',
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

    private cleanupPlacingMode(): void {
        if (this.ghostSprite) {
            this.ghostSprite.destroy();
            this.ghostSprite = null;
        }
        this.placingType = null;
        this.input.off('pointermove', this.onGhostMove, this);
    }

    private startPlacing(itemType: ItemType): void {
        this.placingType = itemType;

        // 고스트 스프라이트 (포인터를 따라다님)
        if (this.ghostSprite) this.ghostSprite.destroy();
        this.ghostSprite = this.add.image(GAME_WIDTH / 2, ONSEN_POOL_Y + ONSEN_POOL_H / 2, ATLAS_UI_KEY, `onsen-deco-${itemType}`)
            .setDisplaySize(ONSEN_ITEM_DISPLAY_SIZE * 0.8, ONSEN_ITEM_DISPLAY_SIZE * 0.8)
            .setAlpha(0.5);

        // 포인터 이동 시 고스트 추적
        this.input.on('pointermove', this.onGhostMove, this);

        // 안내 텍스트 변경
        this.titleText.setText('온천 영역을 탭하여 배치!');
    }

    private onGhostMove(pointer: Phaser.Input.Pointer): void {
        if (this.ghostSprite) {
            this.ghostSprite.x = Phaser.Math.Clamp(pointer.x, ONSEN_POOL_X + 20, ONSEN_POOL_X + ONSEN_POOL_W - 20);
            this.ghostSprite.y = Phaser.Math.Clamp(pointer.y, ONSEN_POOL_Y + 20, ONSEN_POOL_Y + ONSEN_POOL_H - 20);
        }
    }

    private onPoolTap(px: number, py: number): void {
        if (!this.placingType) return;

        const itemType = this.placingType;
        const count = this.inventory[itemType];
        if (count <= 0) {
            this.cleanupPlacingMode();
            return;
        }

        // 인벤토리 차감
        this.inventory[itemType]--;
        const countText = this.inventoryTexts.get(itemType);
        if (countText) countText.setText(`x${this.inventory[itemType]}`);

        // InventoryManager를 통해 인벤토리 저장
        this.inventoryMgr.saveInventory(this.inventory);

        // 배치 정보 저장
        const placed: PlacedItem = { itemType, x: px, y: py };
        this.layout.placedItems.push(placed);
        this.inventoryMgr.saveOnsenLayout(this.layout);

        // 스프라이트 추가
        const sprite = this.add.image(px, py, ATLAS_UI_KEY, `onsen-deco-${itemType}`)
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
        this.cleanupPlacingMode();
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
        this.poolGraphics.fillRoundedRect(ONSEN_POOL_X - 10, ONSEN_POOL_Y - 10, ONSEN_POOL_W + 20, ONSEN_POOL_H + 20, 30);
        this.poolGraphics.fillStyle(colors.water, 1);
        this.poolGraphics.fillRoundedRect(ONSEN_POOL_X, ONSEN_POOL_Y, ONSEN_POOL_W, ONSEN_POOL_H, 24);
        // 물결 웨이브는 create()에서 tween으로 이미 동작 중
    }

    /**
     * 온천 씬 스크린샷을 캡처하여 공유하거나 다운로드한다.
     * 1) 공유 버튼을 일시적으로 숨겨 스크린샷에서 제외
     * 2) renderer.snapshot()으로 캔버스 캡처
     * 3) Web Share API 지원 시 이미지 파일로 공유, 미지원 시 PNG 다운로드
     */
    private captureAndShare(): void {
        if (!this.shareButtonHandle) return;

        // 공유 버튼 숨김 (스크린샷에 포함되지 않도록)
        this.shareButtonHandle.setVisible(false);

        // 렌더러가 다음 프레임을 그린 뒤 캡처되도록 한 프레임 지연
        this.time.delayedCall(50, () => {
            this.game.renderer.snapshot((image: HTMLImageElement | Phaser.Display.Color) => {
                // 공유 버튼 복원
                this.shareButtonHandle?.setVisible(true);

                if (!(image instanceof HTMLImageElement)) return;

                const dataUrl = image.src;
                const fileName = `onsen-${Date.now()}.png`;

                // Blob 변환 (share/download 공통 사용)
                fetch(dataUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], fileName, { type: 'image/png' });

                        // Web Share API 지원 여부 확인 (파일 공유 가능한지 추가 체크)
                        const canShare =
                            typeof navigator !== 'undefined' &&
                            typeof navigator.share === 'function' &&
                            typeof navigator.canShare === 'function' &&
                            navigator.canShare({ files: [file] });

                        if (canShare) {
                            navigator.share({
                                title: '나의 온천 - 카피바라 러너',
                                text: '내가 꾸민 온천을 소개합니다! 🛁',
                                files: [file],
                            }).catch((err: unknown) => {
                                // 사용자가 공유 취소한 경우(AbortError)는 무시
                                if (err instanceof Error && err.name !== 'AbortError') {
                                    console.error('[Onsen] share failed:', err);
                                    this.fallbackDownload(dataUrl, fileName);
                                }
                            });
                        } else {
                            // Web Share API 미지원 또는 파일 공유 불가 → 다운로드
                            this.fallbackDownload(dataUrl, fileName);
                        }
                    })
                    .catch((err: unknown) => {
                        console.error('[Onsen] blob conversion failed:', err);
                        this.shareButtonHandle?.setVisible(true);
                    });
            });
        });
    }

    /**
     * Web Share API 미지원 환경에서 PNG 이미지를 다운로드한다.
     */
    private fallbackDownload(dataUrl: string, fileName: string): void {
        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        anchor.download = fileName;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    }

}
