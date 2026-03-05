import Phaser from 'phaser';
import { PerspectiveCamera } from '../utils/PerspectiveCamera';
import {
    DESPAWN_Z,
    STAGE_COLORS,
} from '../utils/Constants';
import type { StageType } from '../utils/Constants';

interface SceneryItem {
    sprite: Phaser.GameObjects.Graphics;
    z: number;
    side: -1 | 1; // 좌(-1) / 우(1)
    type: 'tree' | 'building' | 'fence';
    active: boolean;
}

const SCENERY_POOL_SIZE = 20; // 좌우 각 10
const SCENERY_SPAWN_Z = 0.95;
const SCENERY_Z_INTERVAL = 0.08;
const SCENERY_ROAD_MARGIN = 40;

/**
 * 도로 양옆 풍경 오브젝트 매니저.
 * 진정한 오브젝트 풀: destroy/new 대신 setVisible(false) + 풀 반환.
 */
export class SceneryManager {
    private scene: Phaser.Scene;
    private activeItems: SceneryItem[] = [];
    private pool: SceneryItem[] = []; // 비활성 오브젝트 풀
    private nextSpawnZ = SCENERY_SPAWN_Z;
    private treeColor = 0x228B22;
    private buildingColor = 0x8B7355;

    constructor(scene: Phaser.Scene, initialStage: StageType = 'forest') {
        this.scene = scene;
        this.setStageColors(initialStage);

        // 초기 풍경 배치
        for (let i = 0; i < SCENERY_POOL_SIZE; i++) {
            const z = SCENERY_SPAWN_Z - i * SCENERY_Z_INTERVAL * 0.5;
            const side = (i % 2 === 0 ? -1 : 1) as -1 | 1;
            this.spawnItem(z, side);
        }
    }

    update(zSpeed: number, dt: number): void {
        // 기존 아이템 이동 — swap-and-pop으로 O(1) 제거
        let i = this.activeItems.length;
        while (i-- > 0) {
            const item = this.activeItems[i];
            item.z -= zSpeed * dt;

            if (item.z < DESPAWN_Z) {
                this.recycleItem(item);
                // swap-and-pop: 마지막 요소로 교체 후 길이 축소
                this.activeItems[i] = this.activeItems[this.activeItems.length - 1];
                this.activeItems.length--;
                continue;
            }

            this.projectItem(item);
        }

        // 새 아이템 스폰
        while (this.activeItems.length < SCENERY_POOL_SIZE) {
            const side = (Math.random() < 0.5 ? -1 : 1) as -1 | 1;
            this.spawnItem(this.nextSpawnZ, side);
            this.nextSpawnZ += SCENERY_Z_INTERVAL * (0.5 + Math.random() * 0.5);
            if (this.nextSpawnZ > 1) this.nextSpawnZ = SCENERY_SPAWN_Z;
        }
    }

    setStageColors(stage: StageType): void {
        const colors = STAGE_COLORS[stage];
        this.treeColor = colors.trees;
        this.buildingColor = colors.ground;
        for (const item of this.activeItems) {
            this.drawItem(item);
        }
    }

    destroy(): void {
        for (const item of this.activeItems) {
            item.sprite.destroy();
        }
        for (const item of this.pool) {
            item.sprite.destroy();
        }
        this.activeItems = [];
        this.pool = [];
    }

    /** 풀에서 재사용 가능한 오브젝트를 가져오거나 새로 생성 */
    private acquireItem(): SceneryItem {
        const recycled = this.pool.pop();
        if (recycled) {
            recycled.sprite.setVisible(true);
            recycled.sprite.setActive(true);
            recycled.active = true;
            return recycled;
        }
        // 풀에 없으면 새로 생성
        const gfx = this.scene.add.graphics().setDepth(2);
        return { sprite: gfx, z: 0, side: 1, type: 'tree', active: true };
    }

    /** 오브젝트를 비활성화하고 풀에 반환 (destroy하지 않음) */
    private recycleItem(item: SceneryItem): void {
        item.active = false;
        item.sprite.setVisible(false);
        item.sprite.setActive(false);
        this.pool.push(item);
    }

    private spawnItem(z: number, side: -1 | 1): void {
        const types: SceneryItem['type'][] = ['tree', 'tree', 'fence', 'building'];
        const type = types[Math.floor(Math.random() * types.length)];

        const item = this.acquireItem();
        item.z = z;
        item.side = side;
        item.type = type;

        this.activeItems.push(item);
        this.drawItem(item);
        this.projectItem(item);
    }

    private drawItem(item: SceneryItem): void {
        const gfx = item.sprite;
        gfx.clear();

        switch (item.type) {
            case 'tree':
                gfx.fillStyle(0x654321, 1);
                gfx.fillRect(-5, -40, 10, 40);
                gfx.fillStyle(this.treeColor, 1);
                gfx.fillTriangle(-25, -40, 0, -90, 25, -40);
                gfx.fillTriangle(-20, -60, 0, -100, 20, -60);
                break;

            case 'building':
                gfx.fillStyle(this.buildingColor, 1);
                gfx.fillRect(-20, -60, 40, 60);
                gfx.fillStyle(0xFFFF88, 0.7);
                gfx.fillRect(-12, -50, 8, 8);
                gfx.fillRect(4, -50, 8, 8);
                gfx.fillRect(-12, -35, 8, 8);
                gfx.fillRect(4, -35, 8, 8);
                break;

            case 'fence':
                gfx.fillStyle(0xDEB887, 1);
                gfx.fillRect(-30, -20, 60, 4);
                gfx.fillRect(-30, -10, 60, 4);
                gfx.fillRect(-28, -25, 4, 25);
                gfx.fillRect(-4, -25, 4, 25);
                gfx.fillRect(20, -25, 4, 25);
                break;
        }
    }

    private projectItem(item: SceneryItem): void {
        const { screenY, scale } = PerspectiveCamera.projectZ(item.z);
        const edge = PerspectiveCamera.getRoadEdgeX(item.z);
        const x = item.side === -1
            ? edge.left - SCENERY_ROAD_MARGIN * scale
            : edge.right + SCENERY_ROAD_MARGIN * scale;

        item.sprite.setPosition(x, screenY);
        item.sprite.setScale(scale);
        item.sprite.setAlpha(Math.min(1, scale * 2));
        item.sprite.setDepth(2 + (1 - item.z) * 3);
    }
}
