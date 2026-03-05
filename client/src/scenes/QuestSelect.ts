import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_QUEST_SELECT,
    SCENE_GAME,
    SCENE_MAIN_MENU,
    FONT_FAMILY,
} from '../utils/Constants';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';
import { DEFAULT_QUESTS, type QuestDefinition } from '../systems/QuestManager';
import { SoundManager } from '../services/SoundManager';

export class QuestSelect extends Phaser.Scene {
    constructor() {
        super(SCENE_QUEST_SELECT);
    }

    shutdown(): void {
        this.tweens.killAll();
        this.time.removeAllEvents();
    }

    create(): void {
        fadeIn(this);

        // 배경
        this.cameras.main.setBackgroundColor('#FFF8E1');

        // 제목
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.07, '퀘스트 선택', {
            fontFamily: FONT_FAMILY,
            fontSize: '40px',
            color: '#E65100',
            fontStyle: 'bold',
            stroke: '#FFFFFF',
            strokeThickness: 3,
        }).setOrigin(0.5);

        // 부제
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.13, '목표를 달성하면 게임 성공! 귤 보상을 획득하세요', {
            fontFamily: FONT_FAMILY,
            fontSize: '18px',
            color: '#795548',
        }).setOrigin(0.5);

        // 구분선
        const line = this.add.graphics();
        line.lineStyle(2, 0xFFCC80, 1);
        line.lineBetween(60, GAME_HEIGHT * 0.165, GAME_WIDTH - 60, GAME_HEIGHT * 0.165);

        // 퀘스트 카드 목록
        const startY = GAME_HEIGHT * 0.20;
        const cardH = 118;
        const cardGap = 14;

        DEFAULT_QUESTS.forEach((quest, i) => {
            const cardY = startY + i * (cardH + cardGap);
            this.createQuestCard(quest, cardY);
        });

        // 뒤로가기 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.95,
            label: '뒤로', color: 0x757575, width: 200, height: 46, fontSize: '22px', radius: 12,
            callback: () => fadeToScene(this, SCENE_MAIN_MENU),
        });
    }

    private createQuestCard(quest: QuestDefinition, cardY: number): void {
        const cardW = GAME_WIDTH - 80;
        const cardX = 40;
        const cardH = 110;

        // 카드 배경
        const bg = this.add.graphics();
        bg.fillStyle(0xFFFFFF, 1);
        bg.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
        bg.lineStyle(2, 0xFFB74D, 1);
        bg.strokeRoundedRect(cardX, cardY, cardW, cardH, 12);

        // 타입 아이콘 + 색상
        const { icon, color } = this.questTypeVisuals(quest);

        // 아이콘 원형 배경
        const iconBg = this.add.graphics();
        iconBg.fillStyle(color, 0.15);
        iconBg.fillCircle(cardX + 46, cardY + cardH / 2, 30);

        // 아이콘 텍스트
        this.add.text(cardX + 46, cardY + cardH / 2, icon, {
            fontFamily: FONT_FAMILY,
            fontSize: '28px',
        }).setOrigin(0.5);

        // 설명
        this.add.text(cardX + 92, cardY + 20, quest.description, {
            fontFamily: FONT_FAMILY,
            fontSize: '22px',
            color: '#3E2723',
            fontStyle: 'bold',
        });

        // 보상 표시
        this.add.text(cardX + 92, cardY + 50, `보상: 귤 +${quest.rewardMandarin}개`, {
            fontFamily: FONT_FAMILY,
            fontSize: '17px',
            color: '#F57C00',
        });

        // 시작 버튼
        const btnX = cardX + cardW - 64;
        const btnY = cardY + cardH / 2;
        const btnBg = this.add.graphics();
        btnBg.fillStyle(color, 1);
        btnBg.fillRoundedRect(btnX - 52, btnY - 18, 104, 36, 10);
        const btnLabel = this.add.text(btnX, btnY, '도전!', {
            fontFamily: FONT_FAMILY,
            fontSize: '20px',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // 인터랙티브 영역 (카드 전체)
        const hitZone = this.add.rectangle(
            cardX + cardW / 2, cardY + cardH / 2,
            cardW, cardH,
        ).setInteractive({ useHandCursor: true });

        hitZone.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0xFFF3E0, 1);
            bg.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
            bg.lineStyle(2, 0xF57C00, 1);
            bg.strokeRoundedRect(cardX, cardY, cardW, cardH, 12);
        });

        hitZone.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0xFFFFFF, 1);
            bg.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
            bg.lineStyle(2, 0xFFB74D, 1);
            bg.strokeRoundedRect(cardX, cardY, cardW, cardH, 12);
        });

        hitZone.on('pointerdown', () => {
            SoundManager.getInstance().playSfx('button');
            // 버튼 눌림 애니메이션
            this.tweens.add({
                targets: [btnBg, btnLabel],
                scaleX: 0.92, scaleY: 0.92,
                duration: 80,
                yoyo: true,
                onComplete: () => {
                    fadeToScene(this, SCENE_GAME, { mode: 'quest', questId: quest.id });
                },
            });
        });
    }

    private questTypeVisuals(quest: QuestDefinition): { icon: string; color: number } {
        switch (quest.type) {
            case 'distance': return { icon: '🏃', color: 0x42A5F5 };
            case 'collect':  return { icon: '🍊', color: 0xFF7043 };
            case 'dodge':    return { icon: '🚧', color: 0xAB47BC };
        }
    }
}
