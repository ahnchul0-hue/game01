import Phaser from 'phaser';
import { ZObject } from '../objects/ZObject';

/** Generic pool for z-axis game objects. Subclass to add typed spawn(). */
export class ZObjectPool<T extends ZObject> {
    private group: Phaser.Physics.Arcade.Group;

    constructor(
        scene: Phaser.Scene,
        classType: typeof Phaser.Physics.Arcade.Sprite,
        maxSize: number,
    ) {
        this.group = scene.physics.add.group({
            classType,
            maxSize,
            runChildUpdate: true,
            active: false,
            visible: false,
        });
    }

    /** Get an inactive object from the pool, or null if full. */
    protected acquire(): T | null {
        return this.group.get() as T | null;
    }

    deactivateAll(): void {
        for (const child of this.group.getChildren()) {
            if (child.active) (child as ZObject).deactivate();
        }
    }

    getGroup(): Phaser.Physics.Arcade.Group {
        return this.group;
    }
}
