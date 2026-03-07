import Phaser from 'phaser';
import { ErrorTracker } from './services/ErrorTracker';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY } from './utils/Constants';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { Onsen } from './scenes/Onsen';
import { SkinSelect } from './scenes/SkinSelect';
import { Missions } from './scenes/Missions';
import { CompanionSelect } from './scenes/CompanionSelect';
import { QuestSelect } from './scenes/QuestSelect';
import { JourneyDiary } from './scenes/JourneyDiary';
import { Shop } from './scenes/Shop';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    antialias: false,
    roundPixels: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
        activePointers: 1,
        smoothFactor: 0,
        mouse: { target: 'game-container' },
        touch: { target: 'game-container' },
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: GRAVITY },
            debug: false,
        },
    },
    scene: [Boot, Preloader, MainMenu, Game, GameOver, Onsen, SkinSelect, Missions, CompanionSelect, QuestSelect, JourneyDiary, Shop],
};

// 프로덕션 에러 트래킹 설치 (Phaser 초기화 전)
ErrorTracker.install();

new Phaser.Game(config);

// Screen orientation lock (portrait) — API may not be available in all browsers
const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
if (orient?.lock) {
    orient.lock('portrait').catch(() => {});
}
