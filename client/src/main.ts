import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY } from './utils/Constants';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { Onsen } from './scenes/Onsen';
import { SkinSelect } from './scenes/SkinSelect';
import { Missions } from './scenes/Missions';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
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
    scene: [Boot, Preloader, MainMenu, Game, GameOver, Onsen, SkinSelect, Missions],
};

new Phaser.Game(config);

// Screen orientation lock (portrait) — API may not be available in all browsers
const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
if (orient?.lock) {
    orient.lock('portrait').catch(() => {});
}
