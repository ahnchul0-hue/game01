import Phaser from 'phaser';
import { STAGE_COLORS, FONT_FAMILY } from '../utils/Constants';
import type { DiaryEntry } from '../utils/DiaryData';
import { getEntryProgress } from '../utils/DiaryData';
import { drawDiaryIllustration } from './DiaryIllustration';

const CARD_W = 640;
const CARD_H = 140;
const ILLUST_SIZE = 120;
const ILLUST_PAD = 10;

export class DiaryCard {
    private objects: Phaser.GameObjects.GameObject[] = [];

    constructor(scene: Phaser.Scene, entry: DiaryEntry, x: number, y: number, maxDistance: number) {
        const unlocked = maxDistance >= entry.distance;
        const progress = getEntryProgress(entry, maxDistance);

        const bg = scene.add.graphics();
        const bgColor = unlocked ? STAGE_COLORS[entry.stage].sky : 0x888888;
        bg.fillStyle(bgColor, unlocked ? 0.85 : 0.5);
        bg.fillRoundedRect(x, y, CARD_W, CARD_H, 12);
        bg.lineStyle(2, unlocked ? 0xFFFFFF : 0x666666, 0.4);
        bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 12);
        this.objects.push(bg);

        if (unlocked) {
            const illust = drawDiaryIllustration(scene, x + ILLUST_PAD, y + ILLUST_PAD, entry.stage);
            this.objects.push(illust);

            const title = scene.add.text(x + ILLUST_SIZE + 24, y + 16, entry.title, {
                fontFamily: FONT_FAMILY, fontSize: '22px', color: '#FFFFFF',
                fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
            });
            this.objects.push(title);

            const story = scene.add.text(x + ILLUST_SIZE + 24, y + 50, entry.story, {
                fontFamily: FONT_FAMILY, fontSize: '16px', color: '#FFE0B2',
                stroke: '#000000', strokeThickness: 2,
                wordWrap: { width: CARD_W - ILLUST_SIZE - 50 },
            });
            this.objects.push(story);

            const badge = scene.add.text(x + CARD_W - 16, y + CARD_H - 16, `${entry.distance}m`, {
                fontFamily: FONT_FAMILY, fontSize: '13px', color: '#BBBBBB',
                stroke: '#000000', strokeThickness: 1,
            }).setOrigin(1, 1);
            this.objects.push(badge);
        } else {
            const lock = scene.add.text(x + ILLUST_PAD + ILLUST_SIZE / 2, y + 35, '\uD83D\uDD12', {
                fontSize: '36px',
            }).setOrigin(0.5);
            this.objects.push(lock);

            const hiddenTitle = scene.add.text(x + ILLUST_SIZE + 24, y + 20, '???', {
                fontFamily: FONT_FAMILY, fontSize: '22px', color: '#AAAAAA', fontStyle: 'bold',
            });
            this.objects.push(hiddenTitle);

            const hint = scene.add.text(x + ILLUST_SIZE + 24, y + 55, `${entry.distance}m 도달 시 해금`, {
                fontFamily: FONT_FAMILY, fontSize: '14px', color: '#999999',
            });
            this.objects.push(hint);

            const barX = x + ILLUST_SIZE + 24;
            const barY = y + CARD_H - 28;
            const barW = CARD_W - ILLUST_SIZE - 50;
            const barBg = scene.add.graphics();
            barBg.fillStyle(0x444444, 1);
            barBg.fillRoundedRect(barX, barY, barW, 10, 5);
            if (progress > 0) {
                barBg.fillStyle(0x4CAF50, 1);
                barBg.fillRoundedRect(barX, barY, barW * progress, 10, 5);
            }
            this.objects.push(barBg);

            const pctText = scene.add.text(barX + barW + 8, barY - 2, `${Math.floor(progress * 100)}%`, {
                fontFamily: FONT_FAMILY, fontSize: '12px', color: '#AAAAAA',
            });
            this.objects.push(pctText);
        }
    }

    destroy(): void {
        for (const obj of this.objects) obj.destroy();
        this.objects = [];
    }
}
