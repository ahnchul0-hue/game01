import Phaser from 'phaser';
import { ZObject } from './ZObject';
import { ITEM_POINTS, ITEM_SIZE } from '../utils/Constants';
import type { ItemType } from '../utils/Constants';
import { ATLAS_GAME_KEY } from '../utils/TextureAtlasBuilder';

export class Item extends ZObject {
    itemType: ItemType = 'mandarin';
    points: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, ATLAS_GAME_KEY, 'item-mandarin');
    }

    activate(lane: number, z: number, type: ItemType, zSpeed: number): void {
        this.itemType = type;
        this.points = ITEM_POINTS[type];
        this.activateZ(lane, z, zSpeed, `item-${type}`, ITEM_SIZE, ITEM_SIZE);
    }
}
