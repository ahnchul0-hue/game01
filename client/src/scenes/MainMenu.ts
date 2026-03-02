import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_MAIN_MENU,
    SCENE_GAME,
    SCENE_ONSEN,
    SCENE_SKIN_SELECT,
} from '../utils/Constants';
import { ApiClient } from '../services/ApiClient';
import { InventoryManager } from '../services/InventoryManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';

export class MainMenu extends Phaser.Scene {
    constructor() {
        super(SCENE_MAIN_MENU);
    }

    create(): void {
        // 게스트 유저 생성 후 서버 동기화 (ensureUser 완료 대기 후 sync)
        const api = ApiClient.getInstance();
        const inventoryMgr = InventoryManager.getInstance();
        api.ensureUser().then(() => inventoryMgr.syncFromServer());

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
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.52,
            label: 'START', color: 0x4CAF50, width: 280, height: 64, fontSize: '28px', radius: 16,
            callback: () => fadeToScene(this, SCENE_GAME, { mode: 'normal' }),
        });

        // 릴렉스 모드 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.62,
            label: 'RELAX MODE', color: 0x81C784, width: 280, height: 64, fontSize: '28px', radius: 16,
            callback: () => fadeToScene(this, SCENE_GAME, { mode: 'relax' }),
        });

        // 온천 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.72,
            label: 'ONSEN', color: 0xFF8C00, width: 280, height: 64, fontSize: '28px', radius: 16,
            callback: () => fadeToScene(this, SCENE_ONSEN),
        });

        // 스킨 버튼
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.82,
            label: 'SKINS', color: 0x8B008B, width: 280, height: 64, fontSize: '28px', radius: 16,
            callback: () => fadeToScene(this, SCENE_SKIN_SELECT),
        });
    }
}
