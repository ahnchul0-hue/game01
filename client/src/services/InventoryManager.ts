import { ApiClient } from './ApiClient';
import {
    type CollectedItems,
    type Inventory,
    type OnsenLayout,
    type SkinId,
    LS_KEY_INVENTORY,
    LS_KEY_ONSEN_LAYOUT,
    LS_KEY_SELECTED_SKIN,
    LS_KEY_UNLOCKED_SKINS,
    LS_KEY_MAX_DISTANCE,
} from '../utils/Constants';

const DEFAULT_INVENTORY: Inventory = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
const DEFAULT_LAYOUT: OnsenLayout = { placedItems: [] };

let _inventoryInstance: InventoryManager | null = null;

export class InventoryManager {
    private api: ApiClient;

    constructor(api: ApiClient) {
        this.api = api;
    }

    /** 싱글턴 인스턴스 반환 */
    static getInstance(): InventoryManager {
        if (!_inventoryInstance) {
            _inventoryInstance = new InventoryManager(ApiClient.getInstance());
        }
        return _inventoryInstance;
    }

    // --- Inventory ---

    getInventory(): Inventory {
        try {
            const raw = localStorage.getItem(LS_KEY_INVENTORY);
            if (!raw) return { ...DEFAULT_INVENTORY };
            return JSON.parse(raw) as Inventory;
        } catch {
            return { ...DEFAULT_INVENTORY };
        }
    }

    addItems(collected: CollectedItems): void {
        const inv = this.getInventory();
        inv.mandarin += collected.mandarin;
        inv.watermelon += collected.watermelon;
        inv.hotspring_material += collected.hotspring_material;
        localStorage.setItem(LS_KEY_INVENTORY, JSON.stringify(inv));

        // fire-and-forget server sync
        this.api.addInventory(collected);
    }

    saveInventory(inv: Inventory): void {
        localStorage.setItem(LS_KEY_INVENTORY, JSON.stringify(inv));
    }

    // --- Max Distance ---

    getMaxDistance(): number {
        try {
            const raw = localStorage.getItem(LS_KEY_MAX_DISTANCE);
            return raw ? parseInt(raw, 10) : 0;
        } catch {
            return 0;
        }
    }

    updateMaxDistance(distance: number): void {
        try {
            const prev = this.getMaxDistance();
            if (distance > prev) {
                localStorage.setItem(LS_KEY_MAX_DISTANCE, distance.toString());
            }
        } catch {
            // ignore
        }
    }

    // --- Onsen Layout ---

    getOnsenLayout(): OnsenLayout {
        try {
            const raw = localStorage.getItem(LS_KEY_ONSEN_LAYOUT);
            if (!raw) return { ...DEFAULT_LAYOUT, placedItems: [] };
            return JSON.parse(raw) as OnsenLayout;
        } catch {
            return { ...DEFAULT_LAYOUT, placedItems: [] };
        }
    }

    saveOnsenLayout(layout: OnsenLayout): void {
        const json = JSON.stringify(layout);
        localStorage.setItem(LS_KEY_ONSEN_LAYOUT, json);
        this.api.saveOnsenLayout(json);
    }

    // --- Skins ---

    getSelectedSkin(): SkinId {
        return (localStorage.getItem(LS_KEY_SELECTED_SKIN) as SkinId) || 'default';
    }

    saveSelectedSkin(skinId: SkinId): void {
        localStorage.setItem(LS_KEY_SELECTED_SKIN, skinId);
        this.api.saveSkins(skinId, this.getUnlockedSkins());
    }

    getUnlockedSkins(): SkinId[] {
        try {
            const raw = localStorage.getItem(LS_KEY_UNLOCKED_SKINS);
            if (!raw) return ['default'];
            return JSON.parse(raw) as SkinId[];
        } catch {
            return ['default'];
        }
    }

    saveUnlockedSkins(skins: SkinId[]): void {
        localStorage.setItem(LS_KEY_UNLOCKED_SKINS, JSON.stringify(skins));
        this.api.saveSkins(this.getSelectedSkin(), skins);
    }

    // --- Server sync ---

    async syncFromServer(): Promise<void> {
        try {
            const [inv, layoutJson, skins] = await Promise.all([
                this.api.getInventory(),
                this.api.getOnsenLayout(),
                this.api.getSkins(),
            ]);

            if (inv) {
                // 머지 전략: 로컬 vs 서버 중 더 큰 값 유지 (오프라인 수집 데이터 보호)
                const local = this.getInventory();
                this.saveInventory({
                    mandarin: Math.max(local.mandarin, inv.mandarin),
                    watermelon: Math.max(local.watermelon, inv.watermelon),
                    hotspring_material: Math.max(local.hotspring_material, inv.hotspring_material),
                });
            }

            if (layoutJson) {
                localStorage.setItem(LS_KEY_ONSEN_LAYOUT, layoutJson);
            }

            if (skins) {
                localStorage.setItem(LS_KEY_SELECTED_SKIN, skins.selected_skin);
                localStorage.setItem(LS_KEY_UNLOCKED_SKINS, skins.unlocked_skins);
            }
        } catch {
            // offline — use localStorage values
        }
    }
}
