import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../utils/Constants';

/**
 * 일시정지 오버레이 컨테이너.
 * 반투명 배경 + "일시정지" 텍스트 + 계속하기/메인 메뉴 버튼을 포함한다.
 * Game.ts의 pauseGame() 인라인 코드에서 추출.
 */
export class PauseOverlay extends Phaser.GameObjects.Container {
    private hitZones: Phaser.GameObjects.Zone[] = [];

    constructor(
        scene: Phaser.Scene,
        onResume: () => void,
        onMainMenu: () => void,
    ) {
        super(scene, 0, 0);
        scene.add.existing(this);
        this.setDepth(400);

        // 반투명 배경
        const overlay = scene.add.graphics();
        overlay.fillStyle(0x000000, 0.5);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this.add(overlay);

        // 제목
        const pauseText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, '일시정지', {
            fontFamily: FONT_FAMILY,
            fontSize: '48px',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add(pauseText);

        // 계속하기 버튼
        const resumeBg = scene.add.graphics();
        resumeBg.fillStyle(0x4CAF50, 1);
        resumeBg.fillRoundedRect(GAME_WIDTH / 2 - 120, GAME_HEIGHT / 2 - 10, 240, 60, 12);
        this.add(resumeBg);

        const resumeLabel = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, '계속하기', {
            fontFamily: FONT_FAMILY,
            fontSize: '28px',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add(resumeLabel);

        const resumeZone = scene.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 240, 60)
            .setInteractive({ useHandCursor: true });
        this.hitZones.push(resumeZone);
        this.add(resumeZone);
        resumeZone.once('pointerdown', () => {
            this.destroyHitZones();
            onResume();
        });

        // 메인 메뉴 버튼
        const menuBg = scene.add.graphics();
        menuBg.fillStyle(0x757575, 1);
        menuBg.fillRoundedRect(GAME_WIDTH / 2 - 120, GAME_HEIGHT / 2 + 70, 240, 60, 12);
        this.add(menuBg);

        const menuLabel = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, '메인 메뉴', {
            fontFamily: FONT_FAMILY,
            fontSize: '28px',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add(menuLabel);

        const menuZone = scene.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, 240, 60)
            .setInteractive({ useHandCursor: true });
        this.hitZones.push(menuZone);
        this.add(menuZone);
        menuZone.once('pointerdown', () => {
            this.destroyHitZones();
            onMainMenu();
        });
    }

    /** 히트존을 명시적으로 제거한다. destroy() 호출 전에 불러야 이벤트가 중복 발화되지 않는다. */
    destroyHitZones(): void {
        for (const zone of this.hitZones) {
            if (zone.scene) zone.destroy();
        }
        this.hitZones = [];
    }

    destroy(fromScene?: boolean): void {
        this.destroyHitZones();
        super.destroy(fromScene);
    }
}
