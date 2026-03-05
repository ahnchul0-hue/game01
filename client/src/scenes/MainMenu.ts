import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_MAIN_MENU,
    SCENE_GAME,
    SCENE_ONSEN,
    SCENE_SKIN_SELECT,
    SCENE_MISSIONS,
    SCENE_COMPANION_SELECT,
    SCENE_QUEST_SELECT,
    FONT_FAMILY,
} from '../utils/Constants';
import { ApiClient } from '../services/ApiClient';
import { InventoryManager } from '../services/InventoryManager';
import { SoundManager } from '../services/SoundManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';
import { isSpecialEvent, getEventBanner, getSeasonTheme } from '../systems/SeasonManager';

export class MainMenu extends Phaser.Scene {
    private onFirstPointer: (() => void) | null = null;
    private onOnline: (() => void) | null = null;
    private onOffline: (() => void) | null = null;

    constructor() {
        super(SCENE_MAIN_MENU);
    }

    shutdown(): void {
        if (this.onFirstPointer) this.input.off('pointerdown', this.onFirstPointer);
        this.onFirstPointer = null;
        if (this.onOnline) window.removeEventListener('online', this.onOnline);
        if (this.onOffline) window.removeEventListener('offline', this.onOffline);
        this.onOnline = null;
        this.onOffline = null;
        this.tweens.killAll();
        this.time.removeAllEvents();
    }

    create(): void {
        // 게스트 유저 생성 후 서버 동기화 (ensureUser 완료 대기 후 sync)
        const api = ApiClient.getInstance();
        const inventoryMgr = InventoryManager.getInstance();
        api.ensureUser().then(() => inventoryMgr.syncFromServer()).catch(() => { /* offline — use local data */ });

        // 오디오 초기화 (브라우저 autoplay 정책: 첫 상호작용 후 init)
        const sound = SoundManager.getInstance();
        this.onFirstPointer = () => {
            if (!sound.isReady()) sound.init();
            sound.playBgm('bgm-menu');
        };
        this.input.once('pointerdown', this.onFirstPointer);
        // 이미 init된 경우 바로 BGM 재생
        if (sound.isReady()) sound.playBgm('bgm-menu');

        // 페이드인
        fadeIn(this);

        // 시즌 테마 배경색 적용
        const seasonTheme = getSeasonTheme();
        this.cameras.main.setBackgroundColor(seasonTheme.bgCss);

        // 타이틀
        const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, 'Capybara Runner', {
            fontFamily: FONT_FAMILY,
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

        // A6: 한글 통일 + 그룹화 레이아웃
        // ── 플레이 모드 그룹 ──
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.44,
            label: '시작', color: 0x4CAF50, width: 280, height: 52, fontSize: '26px', radius: 14,
            callback: () => fadeToScene(this, SCENE_GAME, { mode: 'normal' }),
        });

        createButton(this, {
            x: GAME_WIDTH / 2 - 75, y: GAME_HEIGHT * 0.505,
            label: '릴랙스', color: 0x81C784, width: 130, height: 44, fontSize: '20px', radius: 12,
            callback: () => fadeToScene(this, SCENE_GAME, { mode: 'relax' }),
        });

        createButton(this, {
            x: GAME_WIDTH / 2 + 75, y: GAME_HEIGHT * 0.505,
            label: '퀘스트', color: 0xF57C00, width: 130, height: 44, fontSize: '20px', radius: 12,
            callback: () => fadeToScene(this, SCENE_QUEST_SELECT),
        });

        // ── 꾸미기 그룹 ──
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.585,
            label: '나의 온천', color: 0xFF8C00, width: 280, height: 48, fontSize: '22px', radius: 14,
            callback: () => fadeToScene(this, SCENE_ONSEN),
        });

        createButton(this, {
            x: GAME_WIDTH / 2 - 75, y: GAME_HEIGHT * 0.65,
            label: '스킨', color: 0x8B008B, width: 130, height: 44, fontSize: '20px', radius: 12,
            callback: () => fadeToScene(this, SCENE_SKIN_SELECT),
        });

        createButton(this, {
            x: GAME_WIDTH / 2 + 75, y: GAME_HEIGHT * 0.65,
            label: '동물친구', color: 0x2E7D32, width: 130, height: 44, fontSize: '20px', radius: 12,
            callback: () => fadeToScene(this, SCENE_COMPANION_SELECT),
        });

        // ── 시스템 ──
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.73,
            label: '미션', color: 0x1565C0, width: 280, height: 48, fontSize: '22px', radius: 14,
            callback: () => fadeToScene(this, SCENE_MISSIONS),
        });

        // 특별 이벤트 배너 표시
        if (isSpecialEvent()) {
            const banner = getEventBanner();
            if (banner) {
                // 배너 배경 그래픽
                const bannerGfx = this.add.graphics();
                bannerGfx.fillStyle(banner.bgColor, 0.92);
                bannerGfx.fillRoundedRect(
                    GAME_WIDTH * 0.1,
                    GAME_HEIGHT * 0.875,
                    GAME_WIDTH * 0.8,
                    52,
                    12,
                );
                bannerGfx.setDepth(100);

                // 배너 텍스트
                const bannerText = this.add.text(
                    GAME_WIDTH / 2,
                    GAME_HEIGHT * 0.875 + 26,
                    banner.text,
                    {
                        fontFamily: FONT_FAMILY,
                        fontSize: '22px',
                        color: banner.textColor,
                        fontStyle: 'bold',
                        stroke: '#00000033',
                        strokeThickness: 2,
                    },
                ).setOrigin(0.5).setDepth(101);

                // 배너 등장/사라짐 루프 애니메이션
                this.tweens.add({
                    targets: [bannerGfx, bannerText],
                    alpha: { from: 0.85, to: 1 },
                    duration: 900,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                });
            }
        }

        // P5: 오프라인 상태 표시
        const offlineBadge = this.add.text(GAME_WIDTH / 2, 10, 'OFFLINE', {
            fontFamily: FONT_FAMILY, fontSize: '14px', color: '#FFFFFF',
            backgroundColor: '#E53935', padding: { left: 12, right: 12, top: 4, bottom: 4 },
        }).setOrigin(0.5, 0).setDepth(500).setVisible(!navigator.onLine);
        this.onOnline = () => offlineBadge.setVisible(false);
        this.onOffline = () => offlineBadge.setVisible(true);
        window.addEventListener('online', this.onOnline);
        window.addEventListener('offline', this.onOffline);

        // 사운드 컨트롤 (우측 하단)
        const controlY = GAME_HEIGHT - 30;
        const muteLabel = sound.isMuted() ? 'UNMUTE' : 'MUTE';
        const muteText = this.add.text(GAME_WIDTH - 20, controlY, muteLabel, {
            fontFamily: FONT_FAMILY, fontSize: '18px', color: '#999999',
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        muteText.on('pointerdown', () => {
            const nowMuted = !sound.isMuted();
            sound.setMuted(nowMuted);
            muteText.setText(nowMuted ? 'UNMUTE' : 'MUTE');
            if (!nowMuted) sound.playBgm('bgm-menu');
        });

        // BGM 볼륨 (3단계 토글)
        const bgmLevels = [0, 0.09, 0.18];
        const bgmLabels = ['BGM:OFF', 'BGM:LOW', 'BGM:HI'];
        let bgmIdx = bgmLevels.indexOf(sound.getBgmVolume());
        if (bgmIdx < 0) bgmIdx = 2;
        const bgmText = this.add.text(20, controlY, bgmLabels[bgmIdx], {
            fontFamily: FONT_FAMILY, fontSize: '16px', color: '#999999',
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        bgmText.on('pointerdown', () => {
            bgmIdx = (bgmIdx + 1) % bgmLevels.length;
            sound.setBgmVolume(bgmLevels[bgmIdx]);
            bgmText.setText(bgmLabels[bgmIdx]);
        });

        // SFX 볼륨 (3단계 토글)
        const sfxLevels = [0, 0.3, 0.6];
        const sfxLabels = ['SFX:OFF', 'SFX:LOW', 'SFX:HI'];
        let sfxIdx = sfxLevels.indexOf(sound.getSfxVolume());
        if (sfxIdx < 0) sfxIdx = 2;
        const sfxText = this.add.text(110, controlY, sfxLabels[sfxIdx], {
            fontFamily: FONT_FAMILY, fontSize: '16px', color: '#999999',
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        sfxText.on('pointerdown', () => {
            sfxIdx = (sfxIdx + 1) % sfxLevels.length;
            sound.setSfxVolume(sfxLevels[sfxIdx]);
            sfxText.setText(sfxLabels[sfxIdx]);
            sound.playSfx('button');
        });
    }
}
