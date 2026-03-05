import Phaser from 'phaser';
import { ZObjectPool } from './ZObjectPool';
import { Item } from '../objects/Item';
import { ITEM_POOL_SIZE_3D } from '../utils/Constants';
import type { ItemType } from '../utils/Constants';

export class ItemPool extends ZObjectPool<Item> {
    constructor(scene: Phaser.Scene) {
        super(scene, Item, ITEM_POOL_SIZE_3D);
    }

    spawn(lane: number, z: number, type: ItemType, zSpeed: number): Item | null {
        const obj = this.acquire();
        if (obj) obj.activate(lane, z, type, zSpeed);
        return obj;
    }
}
