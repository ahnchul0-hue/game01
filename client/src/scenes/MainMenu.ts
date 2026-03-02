import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_MAIN_MENU,
    SCENE_GAME,
    SCENE_ONSEN,
    SCENE_SKIN_SELECT,
    SCENE_MISSIONS,
} from '../utils/Constants';
import { ApiClient } from '../services/ApiClient';
import { InventoryManager } from '../services/InventoryManager';
import { SoundManager } from '../services/SoundManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';

export class MainMenu extends Phaser.Scene {
    constructor() {
        super(SCENE_MAIN_MENU);
    }

    shutdown(): void {
        this.input.off('pointerdown');
        this.tweens.killAll();
    }

    create(): void {
        // 게스트 유저 생성 후 서버 동기화 (ensureUser 완료 대기 후 sync)
        const api = ApiClient.getInstance();
        const inventoryMgr = InventoryManager.getInstance();
        api.ensureUser().then(() => inventoryMgr.syncFromServer()).catch(() => { /* offline — use local data */ });

        // 오디오 초기화 (브라우저 autoplay 정책: 첫 상호작용 후 init)
        const sound = SoundManager.getInstance();
        this.input.once('pointerdown', () => {
            sound.init();
            sound.playBgm('bgm-menu');
        });
        // 이미 init된 경우 바로 BGM 재생
        if (sound.isReady()) sound.playBgm('bgm-menu');

        // 페이드인
        fadeIn(this);

        // 배경
        this.cameras.main.setBackgroundColor('#87CEEB');

        // 타이틀
        const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, 'Capybara Runner', {
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

        // 카피바라 캐릭터 표시 (선택된 스킨)
        const selectedSkin = inventoryMgr.getSelectedSkin();
        const capybara = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, `capybara-${selectedSkin}`);
        capybara.setScale(2);

        // 시작 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.48,
            label: 'START', color: 0x4CAF50, width: 280, height: 60, fontSize: '28px', radius: 16,
            callback: () => fadeToScene(this, SCENE_GAME, { mode: 'normal' }),
        });

        // 릴렉스 모드 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.57,
            label: 'RELAX MODE', color: 0x81C784, width: 280, height: 60, fontSize: '28px', radius: 16,
            callback: () => fadeToScene(this, SCENE_GAME, { mode: 'relax' }),
        });

        // 온천 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.66,
            label: 'ONSEN', color: 0xFF8C00, width: 280, height: 60, fontSize: '28px', radius: 16,
            callback: () => fadeToScene(this, SCENE_ONSEN),
        });

        // 스킨 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.75,
            label: 'SKINS', color: 0x8B008B, width: 280, height: 60, fontSize: '28px', radius: 16,
            callback: () => fadeToScene(this, SCENE_SKIN_SELECT),
        });

        // 미션 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.84,
            label: '미션', color: 0x1565C0, width: 280, height: 60, fontSize: '28px', radius: 16,
            callback: () => fadeToScene(this, SCENE_MISSIONS),
        });

        // 음소거 토글 버튼
        const muteLabel = sound.isMuted() ? 'UNMUTE' : 'MUTE';
        const muteText = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 30, muteLabel, {
            fontFamily: 'Arial', fontSize: '18px', color: '#999999',
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        muteText.on('pointerdown', () => {
            const nowMuted = !sound.isMuted();
            sound.setMuted(nowMuted);
            muteText.setText(nowMuted ? 'UNMUTE' : 'MUTE');
            if (!nowMuted) sound.playBgm('bgm-menu');
        });
    }
}
