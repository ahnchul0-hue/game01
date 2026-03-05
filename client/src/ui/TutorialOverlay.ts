import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../utils/Constants';

/**
 * 튜토리얼 오버레이 컨테이너.
 * 스와이프/탭 조작법 안내 텍스트 + 전체 화면 닫기 영역을 포함한다.
 * Game.ts의 showTutorial() 인라인 코드에서 추출.
 */
export class TutorialOverlay extends Phaser.GameObjects.Container {
    private dismissZone: Phaser.GameObjects.Zone | null = null;

    constructor(
        scene: Phaser.Scene,
        onClose: () => void,
    ) {
        super(scene, 0, 0);
        scene.add.existing(this);
        this.setDepth(400);

        // 반투명 배경
        const overlay = scene.add.graphics();
        overlay.fillStyle(0x000000, 0.5);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this.add(overlay);

        // 조작법 힌트 목록
        const hints: { icon: string; desc: string; y: number }[] = [
            { icon: '←  →', desc: '좌우 스와이프: 레인 이동', y: GAME_HEIGHT / 2 - 100 },
            { icon: '↑',    desc: '위로 스와이프: 점프',       y: GAME_HEIGHT / 2 - 30  },
            { icon: '↓',    desc: '아래로 스와이프: 슬라이드', y: GAME_HEIGHT / 2 + 40  },
        ];

        for (const h of hints) {
            const iconText = scene.add.text(GAME_WIDTH / 2 - 120, h.y, h.icon, {
                fontFamily: FONT_FAMILY,
                fontSize: '32px',
                color: '#FFD700',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            const descText = scene.add.text(GAME_WIDTH / 2 + 40, h.y, h.desc, {
                fontFamily: FONT_FAMILY,
                fontSize: '22px',
                color: '#FFFFFF',
            }).setOrigin(0, 0.5);
            this.add([iconText, descText]);
        }

        // "탭하여 시작" — 깜빡이는 텍스트
        const tapText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140, '탭하여 시작', {
            fontFamily: FONT_FAMILY,
            fontSize: '28px',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add(tapText);
        scene.tweens.add({ targets: tapText, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

        // 전체 화면 닫기 영역
        this.dismissZone = scene.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
            .setInteractive();
        this.add(this.dismissZone);

        this.dismissZone.once('pointerdown', () => {
            this.dismissZone = null; // once가 이미 제거하므로 참조만 비움
            onClose();
        });
    }

    destroy(fromScene?: boolean): void {
        // dismissZone은 컨테이너 자식이므로 super.destroy()가 처리하지만
        // 참조를 명시적으로 null로 비워 중복 이벤트를 방지한다.
        this.dismissZone = null;
        super.destroy(fromScene);
    }
}
