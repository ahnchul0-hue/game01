import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENE_JOURNEY_DIARY, SCENE_MAIN_MENU, FONT_FAMILY } from '../utils/Constants';
import { DIARY_ENTRIES, getUnlockedCount } from '../utils/DiaryData';
import { DiaryCard } from '../ui/DiaryCard';
import { InventoryManager } from '../services/InventoryManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';
import { SoundManager } from '../services/SoundManager';

const CARD_H = 140;
const CARD_GAP = 16;
const HEADER_H = 100;
const CARD_X = 40; // (720 - 640) / 2

export class JourneyDiary extends Phaser.Scene {
    private cards: DiaryCard[] = [];
    private onPointerDown: ((p: Phaser.Input.Pointer) => void) | null = null;
    private onPointerMove: ((p: Phaser.Input.Pointer) => void) | null = null;
    private onPointerUp: (() => void) | null = null;
    private dragStartY = 0;
    private scrollY = 0;
    private isDragging = false;

    constructor() {
        super(SCENE_JOURNEY_DIARY);
    }

    create(): void {
        fadeIn(this);
        const maxDist = InventoryManager.getInstance().getMaxDistance();

        this.cameras.main.setBackgroundColor('#1a1a2e');

        // Header
        this.add.text(GAME_WIDTH / 2, 40, '여정 다이어리', {
            fontFamily: FONT_FAMILY, fontSize: '32px', color: '#FFFFFF',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 72, `${getUnlockedCount(maxDist)}/${DIARY_ENTRIES.length} 해금`, {
            fontFamily: FONT_FAMILY, fontSize: '16px', color: '#AAAAAA',
        }).setOrigin(0.5);

        // Cards
        for (let i = 0; i < DIARY_ENTRIES.length; i++) {
            const cardY = HEADER_H + i * (CARD_H + CARD_GAP);
            const card = new DiaryCard(this, DIARY_ENTRIES[i], CARD_X, cardY, maxDist);
            this.cards.push(card);
        }

        // Back button (fixed on screen)
        const backBtn = createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT - 50,
            label: '돌아가기', color: 0x555555, width: 200, height: 44, fontSize: '20px', radius: 12,
            callback: () => {
                SoundManager.getInstance().playSfx('button');
                fadeToScene(this, SCENE_MAIN_MENU);
            },
        });
        backBtn.container.setScrollFactor(0);
        backBtn.hitArea.setScrollFactor(0);

        // Touch scroll
        const contentH = HEADER_H + DIARY_ENTRIES.length * (CARD_H + CARD_GAP);
        const maxScroll = Math.max(0, contentH - GAME_HEIGHT + 80);

        this.onPointerDown = (p: Phaser.Input.Pointer) => {
            this.isDragging = true;
            this.dragStartY = p.y + this.scrollY;
        };
        this.onPointerMove = (p: Phaser.Input.Pointer) => {
            if (!this.isDragging) return;
            this.scrollY = Phaser.Math.Clamp(this.dragStartY - p.y, 0, maxScroll);
            this.cameras.main.scrollY = this.scrollY;
        };
        this.onPointerUp = () => { this.isDragging = false; };

        this.input.on('pointerdown', this.onPointerDown);
        this.input.on('pointermove', this.onPointerMove);
        this.input.on('pointerup', this.onPointerUp);
    }

    shutdown(): void {
        if (this.onPointerDown) this.input.off('pointerdown', this.onPointerDown);
        if (this.onPointerMove) this.input.off('pointermove', this.onPointerMove);
        if (this.onPointerUp) this.input.off('pointerup', this.onPointerUp);
        for (const card of this.cards) card.destroy();
        this.cards = [];
        this.tweens.killAll();
        this.time.removeAllEvents();
    }
}
