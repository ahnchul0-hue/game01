import { ApiClient } from './ApiClient';
import {
    type CollectedItems,
    type Inventory,
    type OnsenLayout,
    type SkinId,
    type CompanionId,
    SKIN_CONFIGS,
    VALID_COMPANION_IDS,
    LS_KEY_INVENTORY,
    LS_KEY_ONSEN_LAYOUT,
    LS_KEY_SELECTED_SKIN,
    LS_KEY_UNLOCKED_SKINS,
    LS_KEY_MAX_DISTANCE,
    LS_KEY_SELECTED_COMPANION,
    LS_KEY_UNLOCKED_COMPANIONS,
} from '../utils/Constants';

const VALID_SKIN_IDS = new Set<string>(SKIN_CONFIGS.map(s => s.id));

const DEFAULT_INVENTORY: Inventory = { gem: 0, mandarin: 0, watermelon: 0, hotspring_material: 0 };
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
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_INVENTORY, ...parsed };
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
            const parsed = JSON.parse(raw);
            return { placedItems: Array.isArray(parsed?.placedItems) ? parsed.placedItems : [] };
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
        const raw = localStorage.getItem(LS_KEY_SELECTED_SKIN);
        return raw && VALID_SKIN_IDS.has(raw) ? (raw as SkinId) : 'default';
    }

    saveSelectedSkin(skinId: SkinId): void {
        localStorage.setItem(LS_KEY_SELECTED_SKIN, skinId);
        this.api.saveSkins(skinId, this.getUnlockedSkins());
    }

    getUnlockedSkins(): SkinId[] {
        try {
            const raw = localStorage.getItem(LS_KEY_UNLOCKED_SKINS);
            if (!raw) return ['default'];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return ['default'];
            return parsed.filter((s: unknown): s is SkinId => typeof s === 'string' && VALID_SKIN_IDS.has(s as string));
        } catch {
            return ['default'];
        }
    }

    saveUnlockedSkins(skins: SkinId[]): void {
        localStorage.setItem(LS_KEY_UNLOCKED_SKINS, JSON.stringify(skins));
        this.api.saveSkins(this.getSelectedSkin(), skins);
    }

    // --- Companions ---

    getSelectedCompanion(): CompanionId {
        const raw = localStorage.getItem(LS_KEY_SELECTED_COMPANION);
        return raw && VALID_COMPANION_IDS.has(raw) ? (raw as CompanionId) : 'none';
    }

    saveSelectedCompanion(companionId: CompanionId): void {
        localStorage.setItem(LS_KEY_SELECTED_COMPANION, companionId);
        this.api.saveCompanions(companionId, this.getUnlockedCompanions());
    }

    getUnlockedCompanions(): CompanionId[] {
        try {
            const raw = localStorage.getItem(LS_KEY_UNLOCKED_COMPANIONS);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((c: unknown): c is CompanionId => typeof c === 'string' && VALID_COMPANION_IDS.has(c as string));
        } catch {
            return [];
        }
    }

    saveUnlockedCompanions(companions: CompanionId[]): void {
        localStorage.setItem(LS_KEY_UNLOCKED_COMPANIONS, JSON.stringify(companions));
        this.api.saveCompanions(this.getSelectedCompanion(), companions);
    }

    // --- Server sync ---

    async syncFromServer(): Promise<void> {
        const results = await Promise.allSettled([
            this.api.getInventory(),
            this.api.getOnsenLayout(),
            this.api.getSkins(),
            this.api.getCompanions(),
        ]);

        const [invResult, layoutResult, skinsResult, companionsResult] = results;

        if (invResult.status === 'fulfilled' && invResult.value) {
            const inv = invResult.value;
            const local = this.getInventory();
            this.saveInventory({
                gem: Math.max(local.gem, inv.gem ?? 0),
                mandarin: Math.max(local.mandarin, inv.mandarin),
                watermelon: Math.max(local.watermelon, inv.watermelon),
                hotspring_material: Math.max(local.hotspring_material, inv.hotspring_material),
            });
        }

        if (layoutResult.status === 'fulfilled' && layoutResult.value) {
            localStorage.setItem(LS_KEY_ONSEN_LAYOUT, layoutResult.value);
        }

        if (skinsResult.status === 'fulfilled' && skinsResult.value) {
            const skins = skinsResult.value;
            localStorage.setItem(LS_KEY_SELECTED_SKIN, skins.selected_skin);
            localStorage.setItem(LS_KEY_UNLOCKED_SKINS, skins.unlocked_skins);
        }

        if (companionsResult.status === 'fulfilled' && companionsResult.value) {
            const companions = companionsResult.value;
            localStorage.setItem(LS_KEY_SELECTED_COMPANION, companions.selected_companion);
            localStorage.setItem(LS_KEY_UNLOCKED_COMPANIONS, companions.unlocked_companions);
        }
    }

    // --- Gem (Premium Currency) ---

    getGems(): number {
        return this.getInventory().gem;
    }

    addGems(amount: number): void {
        const inv = this.getInventory();
        inv.gem += amount;
        this.saveInventory(inv);
        this.api.addInventory({ mandarin: 0, watermelon: 0, hotspring_material: 0, gem: amount } as unknown as CollectedItems);
    }

    spendGems(amount: number): boolean {
        const inv = this.getInventory();
        if (inv.gem < amount) return false;
        inv.gem -= amount;
        this.saveInventory(inv);
        return true;
    }

    // --- Shop Unlocks ---

    unlockSkin(skinId: SkinId): void {
        const skins = this.getUnlockedSkins();
        if (!skins.includes(skinId)) {
            skins.push(skinId);
            this.saveUnlockedSkins(skins);
        }
    }

    unlockCompanion(companionId: CompanionId): void {
        const companions = this.getUnlockedCompanions();
        if (!companions.includes(companionId)) {
            companions.push(companionId);
            this.saveUnlockedCompanions(companions);
        }
    }

    // --- Revive Tokens ---

    getRevives(): number {
        try {
            return parseInt(localStorage.getItem('capybara_revives') ?? '0', 10);
        } catch { return 0; }
    }

    addRevives(count: number): void {
        const current = this.getRevives();
        localStorage.setItem('capybara_revives', (current + count).toString());
    }

    useRevive(): boolean {
        const current = this.getRevives();
        if (current <= 0) return false;
        localStorage.setItem('capybara_revives', (current - 1).toString());
        return true;
    }
}
