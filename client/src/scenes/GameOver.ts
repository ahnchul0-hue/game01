import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_GAME_OVER,
    SCENE_GAME,
    SCENE_MAIN_MENU,
} from '../utils/Constants';

type GameMode = 'normal' | 'relax';

interface GameOverData {
    score?: number;
    distance?: number;
    mode?: GameMode;
}

export class GameOver extends Phaser.Scene {
    private finalScore = 0;
    private finalDistance = 0;
    private lastMode: GameMode = 'normal';

    constructor() {
        super(SCENE_GAME_OVER);
    }

    init(data: GameOverData): void {
        this.finalScore = data.score ?? 0;
        this.finalDistance = data.distance ?? 0;
        this.lastMode = data.mode ?? 'normal';
    }

    create(): void {
        // 어두운 오버레이
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // 게임 오버 텍스트
        const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, 'GAME OVER', {
            fontFamily: 'Arial',
            fontSize: '56px',
            color: '#FF6B6B',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);

        // 등장 애니메이션
        title.setY(title.y - 50);
        title.setAlpha(0);
        this.tweens.add({
            targets: title,
            y: title.y + 50,
            alpha: 1,
            duration: 500,
            ease: 'Bounce.easeOut',
        });

        // 카피바라 (슬픈)
        const capybara = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, 'capybara');
        capybara.setScale(2);
        capybara.setAlpha(0.7);

        // 점수 카운트업 애니메이션
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.5, 'Score', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#AAAAAA',
        }).setOrigin(0.5);

        const scoreDisplay = { value: 0 };
        const scoreText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.55, '0', {
            fontFamily: 'Arial',
            fontSize: '48px',
            color: '#FFD700',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.tweens.add({
            targets: scoreDisplay,
            value: this.finalScore,
            duration: 1000,
            ease: 'Power1',
            onUpdate: () => {
                scoreText.setText(Math.floor(scoreDisplay.value).toString());
            },
        });

        // 거리 표시
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.63, `${this.finalDistance}m`, {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#FFFFFF',
        }).setOrigin(0.5);

        // 재시작 버튼
        this.createButton(
            GAME_WIDTH / 2,
            GAME_HEIGHT * 0.78,
            'RETRY',
            0x4CAF50,
            () => this.scene.start(SCENE_GAME, { mode: this.lastMode }),
        );

        // 메뉴 버튼
        this.createButton(
            GAME_WIDTH / 2,
            GAME_HEIGHT * 0.88,
            'MENU',
            0x757575,
            () => this.scene.start(SCENE_MAIN_MENU),
        );
    }

    private createButton(
        x: number,
        y: number,
        label: string,
        color: number,
        callback: () => void,
    ): void {
        const btnW = 240;
        const btnH = 56;

        const bg = this.add.graphics();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 14);

        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial',
            fontSize: '26px',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const hitArea = this.add.zone(x, y, btnW, btnH).setInteractive({ useHandCursor: true });

        hitArea.on('pointerdown', () => {
            this.tweens.add({
                targets: [bg, text],
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 80,
                yoyo: true,
                onComplete: callback,
            });
        });
    }
}
