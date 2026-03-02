import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_MAIN_MENU,
    SCENE_GAME,
} from '../utils/Constants';

export class MainMenu extends Phaser.Scene {
    constructor() {
        super(SCENE_MAIN_MENU);
    }

    create(): void {
        // 배경
        this.cameras.main.setBackgroundColor('#87CEEB');

        // 타이틀
        const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.25, 'Capybara Runner', {
            fontFamily: 'Arial',
            fontSize: '48px',
            color: '#5D4037',
            fontStyle: 'bold',
            stroke: '#FFFFFF',
            strokeThickness: 4,
        }).setOrigin(0.5);

        // 타이틀 바운스 애니메이션
        this.tweens.add({
            targets: title,
            y: title.y - 10,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });

        // 카피바라 캐릭터 표시
        const capybara = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, 'capybara');
        capybara.setScale(2);

        // 시작 버튼
        this.createButton(
            GAME_WIDTH / 2,
            GAME_HEIGHT * 0.6,
            'START',
            0x4CAF50,
            () => this.scene.start(SCENE_GAME, { mode: 'normal' }),
        );

        // 릴렉스 모드 버튼
        this.createButton(
            GAME_WIDTH / 2,
            GAME_HEIGHT * 0.7,
            'RELAX MODE',
            0x81C784,
            () => this.scene.start(SCENE_GAME, { mode: 'relax' }),
        );
    }

    private createButton(
        x: number,
        y: number,
        label: string,
        color: number,
        callback: () => void,
    ): void {
        const btnW = 280;
        const btnH = 64;

        const bg = this.add.graphics();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 16);

        const text = this.add.text(x, y, label, {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // 인터랙티브 영역
        const hitArea = this.add.zone(x, y, btnW, btnH).setInteractive({ useHandCursor: true });

        hitArea.on('pointerdown', () => {
            // alpha 변경으로 눌림 효과 (Graphics scale tween 버그 회피)
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
