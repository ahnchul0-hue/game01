import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_SHOP,
    SCENE_MAIN_MENU,
    FONT_FAMILY,
    type SkinId,
    type CompanionId,
} from '../utils/Constants';
import { InventoryManager } from '../services/InventoryManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';

interface ShopItem {
    id: string;
    name: string;
    type: 'skin' | 'companion' | 'revive_pack';
    gemCost: number;
    icon: string;
    description: string;
}

const SHOP_ITEMS: ShopItem[] = [
    { id: 'skin_towel',  name: '수건 카피바라',  type: 'skin', gemCost: 50, icon: '🧖', description: '5,000m 또는 보석 50개' },
    { id: 'skin_yukata', name: '유카타 카피바라', type: 'skin', gemCost: 80, icon: '👘', description: '온천 Lv3 또는 보석 80개' },
    { id: 'skin_santa',  name: '산타 카피바라',   type: 'skin', gemCost: 100, icon: '🎅', description: '아이템 1000개 또는 보석 100개' },
    { id: 'comp_otter',  name: '수달',  type: 'companion', gemCost: 60, icon: '🦦', description: '3,000m 또는 보석 60개' },
    { id: 'comp_duck',   name: '오리',  type: 'companion', gemCost: 60, icon: '🦆', description: '아이템 500개 또는 보석 60개' },
    { id: 'comp_turtle', name: '거북이', type: 'companion', gemCost: 80, icon: '🐢', description: '온천 Lv2 또는 보석 80개' },
    { id: 'revive_3',    name: '부활권 3회',  type: 'revive_pack', gemCost: 30, icon: '💖', description: '부활 기회 +3' },
];

export class Shop extends Phaser.Scene {
    private inventoryMgr!: InventoryManager;
    private gemText!: Phaser.GameObjects.Text;
    private itemContainer!: Phaser.GameObjects.Container;
    

    constructor() {
        super(SCENE_SHOP);
    }

    shutdown(): void {
        this.tweens.killAll();
        this.time.removeAllEvents();
    }

    create(): void {
        this.inventoryMgr = InventoryManager.getInstance();
        this.cameras.main.setBackgroundColor('#2C1810');
        fadeIn(this);

        this.add.text(GAME_WIDTH / 2, 50, '상점', {
            fontFamily: FONT_FAMILY, fontSize: '36px', color: '#FFD700',
        }).setOrigin(0.5);

        this.gemText = this.add.text(GAME_WIDTH / 2, 100, `💎 ${this.inventoryMgr.getGems()}`, {
            fontFamily: FONT_FAMILY, fontSize: '24px', color: '#B0E0FF',
        }).setOrigin(0.5);

        this.itemContainer = this.add.container(0, 140);
        this.renderItems();

        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT - 60, label: '← 메인 메뉴',
            color: 0x5D4037, callback: () => fadeToScene(this, SCENE_MAIN_MENU),
        });
    }

    private renderItems(): void {
        const skins = this.inventoryMgr.getUnlockedSkins();
        const companions = this.inventoryMgr.getUnlockedCompanions();
        const gems = this.inventoryMgr.getGems();

        SHOP_ITEMS.forEach((item, i) => {
            const y = i * 130;
            const owned = this.isOwned(item, skins, companions);
            const afford = gems >= item.gemCost;

            const card = this.add.graphics();
            card.fillStyle(owned ? 0x2E7D32 : (afford ? 0x3E2723 : 0x1A1A1A), 1);
            card.fillRoundedRect(30, y, GAME_WIDTH - 60, 110, 12);
            this.itemContainer.add(card);

            this.itemContainer.add(this.add.text(60, y + 20, item.icon, { fontSize: '40px' }));
            this.itemContainer.add(this.add.text(120, y + 15, item.name, {
                fontFamily: FONT_FAMILY, fontSize: '20px', color: '#FFFFFF',
            }));
            this.itemContainer.add(this.add.text(120, y + 45, item.description, {
                fontFamily: FONT_FAMILY, fontSize: '14px', color: '#AAAAAA',
            }));

            if (owned) {
                this.itemContainer.add(this.add.text(GAME_WIDTH - 100, y + 40, '보유 중', {
                    fontFamily: FONT_FAMILY, fontSize: '16px', color: '#4CAF50',
                }).setOrigin(0.5));
            } else {
                const btn = this.add.graphics();
                btn.fillStyle(afford ? 0xFFD700 : 0x555555, 1);
                btn.fillRoundedRect(GAME_WIDTH - 150, y + 25, 100, 36, 8);
                this.itemContainer.add(btn);

                this.itemContainer.add(this.add.text(GAME_WIDTH - 100, y + 43, `💎 ${item.gemCost}`, {
                    fontFamily: FONT_FAMILY, fontSize: '16px', color: afford ? '#000' : '#888',
                }).setOrigin(0.5));

                if (afford) {
                    btn.setInteractive(new Phaser.Geom.Rectangle(GAME_WIDTH - 150, y + 25, 100, 36), Phaser.Geom.Rectangle.Contains);
                    btn.on('pointerdown', () => this.purchase(item));
                }
            }
        });
    }

    private isOwned(item: ShopItem, skins: SkinId[], companions: CompanionId[]): boolean {
        if (item.type === 'skin') return skins.includes(item.id.replace('skin_', '') as SkinId);
        if (item.type === 'companion') return companions.includes(item.id.replace('comp_', '') as CompanionId);
        return false;
    }

    private purchase(item: ShopItem): void {
        if (!this.inventoryMgr.spendGems(item.gemCost)) return;

        if (item.type === 'skin') this.inventoryMgr.unlockSkin(item.id.replace('skin_', '') as SkinId);
        else if (item.type === 'companion') this.inventoryMgr.unlockCompanion(item.id.replace('comp_', '') as CompanionId);
        else if (item.type === 'revive_pack') this.inventoryMgr.addRevives(3);

        this.gemText.setText(`💎 ${this.inventoryMgr.getGems()}`);
        this.itemContainer.removeAll(true);
        this.renderItems();
    }
}
