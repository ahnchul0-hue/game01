// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryManager } from '../services/InventoryManager';
import {
    LS_KEY_INVENTORY,
    LS_KEY_ONSEN_LAYOUT,
    LS_KEY_SELECTED_SKIN,
    LS_KEY_UNLOCKED_SKINS,
    LS_KEY_SELECTED_COMPANION,
    LS_KEY_UNLOCKED_COMPANIONS,
} from '../utils/Constants';

// Mock ApiClient to avoid network calls
const mockApi = {
    addInventory: vi.fn(),
    getInventory: vi.fn().mockResolvedValue(null),
    saveOnsenLayout: vi.fn(),
    getOnsenLayout: vi.fn().mockResolvedValue(null),
    saveSkins: vi.fn(),
    getSkins: vi.fn().mockResolvedValue(null),
    saveCompanions: vi.fn(),
    getCompanions: vi.fn().mockResolvedValue(null),
} as any;

describe('InventoryManager', () => {
    let mgr: InventoryManager;

    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        mgr = new InventoryManager(mockApi);
    });

    describe('getInventory', () => {
        it('returns default when empty', () => {
            const inv = mgr.getInventory();
            expect(inv).toEqual({ mandarin: 0, watermelon: 0, hotspring_material: 0, gem: 0 });
        });

        it('returns stored values', () => {
            localStorage.setItem(LS_KEY_INVENTORY, JSON.stringify({ mandarin: 10, watermelon: 5, hotspring_material: 3 }));
            const inv = mgr.getInventory();
            expect(inv.mandarin).toBe(10);
            expect(inv.watermelon).toBe(5);
            expect(inv.hotspring_material).toBe(3);
        });

        it('returns default on invalid JSON', () => {
            localStorage.setItem(LS_KEY_INVENTORY, 'not-json');
            const inv = mgr.getInventory();
            expect(inv).toEqual({ mandarin: 0, watermelon: 0, hotspring_material: 0, gem: 0 });
        });

        it('merges partial data with defaults', () => {
            localStorage.setItem(LS_KEY_INVENTORY, JSON.stringify({ mandarin: 7 }));
            const inv = mgr.getInventory();
            expect(inv.mandarin).toBe(7);
            expect(inv.watermelon).toBe(0);
            expect(inv.hotspring_material).toBe(0);
        });
    });

    describe('addItems', () => {
        it('accumulates items', () => {
            mgr.addItems({ mandarin: 5, watermelon: 3, hotspring_material: 1 });
            const inv = mgr.getInventory();
            expect(inv.mandarin).toBe(5);
            expect(inv.watermelon).toBe(3);
        });

        it('accumulates across multiple calls', () => {
            mgr.addItems({ mandarin: 5, watermelon: 0, hotspring_material: 0 });
            mgr.addItems({ mandarin: 3, watermelon: 2, hotspring_material: 0 });
            const inv = mgr.getInventory();
            expect(inv.mandarin).toBe(8);
            expect(inv.watermelon).toBe(2);
        });

        it('calls api.addInventory', () => {
            mgr.addItems({ mandarin: 1, watermelon: 0, hotspring_material: 0 });
            expect(mockApi.addInventory).toHaveBeenCalledWith({ mandarin: 1, watermelon: 0, hotspring_material: 0 });
        });
    });

    describe('maxDistance', () => {
        it('returns 0 when empty', () => {
            expect(mgr.getMaxDistance()).toBe(0);
        });

        it('stores and retrieves', () => {
            mgr.updateMaxDistance(500);
            expect(mgr.getMaxDistance()).toBe(500);
        });

        it('only updates if greater', () => {
            mgr.updateMaxDistance(500);
            mgr.updateMaxDistance(300);
            expect(mgr.getMaxDistance()).toBe(500);
        });

        it('updates when new is greater', () => {
            mgr.updateMaxDistance(500);
            mgr.updateMaxDistance(800);
            expect(mgr.getMaxDistance()).toBe(800);
        });
    });

    describe('onsenLayout', () => {
        it('returns empty layout when empty', () => {
            const layout = mgr.getOnsenLayout();
            expect(layout.placedItems).toEqual([]);
        });

        it('stores and retrieves layout', () => {
            const layout = { placedItems: [{ itemType: 'mandarin' as const, x: 100, y: 200 }] };
            mgr.saveOnsenLayout(layout);
            const retrieved = mgr.getOnsenLayout();
            expect(retrieved.placedItems).toHaveLength(1);
        });

        it('handles invalid JSON gracefully', () => {
            localStorage.setItem(LS_KEY_ONSEN_LAYOUT, 'bad-data');
            const layout = mgr.getOnsenLayout();
            expect(layout.placedItems).toEqual([]);
        });
    });

    describe('selectedSkin', () => {
        it('returns default when empty', () => {
            expect(mgr.getSelectedSkin()).toBe('default');
        });

        it('returns stored valid skin', () => {
            localStorage.setItem(LS_KEY_SELECTED_SKIN, 'towel');
            expect(mgr.getSelectedSkin()).toBe('towel');
        });

        it('returns default for invalid skin', () => {
            localStorage.setItem(LS_KEY_SELECTED_SKIN, 'nonexistent_skin');
            expect(mgr.getSelectedSkin()).toBe('default');
        });
    });

    describe('unlockedSkins', () => {
        it('returns [default] when empty', () => {
            expect(mgr.getUnlockedSkins()).toEqual(['default']);
        });

        it('returns stored valid skins', () => {
            localStorage.setItem(LS_KEY_UNLOCKED_SKINS, JSON.stringify(['default', 'towel']));
            const skins = mgr.getUnlockedSkins();
            expect(skins).toContain('default');
            expect(skins).toContain('towel');
        });

        it('filters out invalid skins', () => {
            localStorage.setItem(LS_KEY_UNLOCKED_SKINS, JSON.stringify(['default', 'invalid_skin', 'towel']));
            const skins = mgr.getUnlockedSkins();
            expect(skins).not.toContain('invalid_skin');
        });

        it('returns [default] on invalid JSON', () => {
            localStorage.setItem(LS_KEY_UNLOCKED_SKINS, 'not-array');
            expect(mgr.getUnlockedSkins()).toEqual(['default']);
        });
    });

    describe('selectedCompanion', () => {
        it('returns none when empty', () => {
            expect(mgr.getSelectedCompanion()).toBe('none');
        });

        it('returns default for invalid companion', () => {
            localStorage.setItem(LS_KEY_SELECTED_COMPANION, 'invalid');
            expect(mgr.getSelectedCompanion()).toBe('none');
        });
    });

    describe('unlockedCompanions', () => {
        it('returns empty array when empty', () => {
            expect(mgr.getUnlockedCompanions()).toEqual([]);
        });

        it('returns empty array on invalid JSON', () => {
            localStorage.setItem(LS_KEY_UNLOCKED_COMPANIONS, '{bad}');
            expect(mgr.getUnlockedCompanions()).toEqual([]);
        });
    });

    // ── syncFromServer — Promise.allSettled 부분 실패 ────────────────

    describe('syncFromServer — 부분 실패 시나리오', () => {
        it('모든 API 호출 성공 시 인벤토리가 서버 값으로 갱신됨 (로컬보다 크면)', async () => {
            // 로컬: mandarin=5, 서버: mandarin=10 → 10으로 갱신
            localStorage.setItem(LS_KEY_INVENTORY, JSON.stringify({ mandarin: 5, watermelon: 0, hotspring_material: 0 }));
            mockApi.getInventory.mockResolvedValueOnce({ mandarin: 10, watermelon: 0, hotspring_material: 0 });
            mockApi.getOnsenLayout.mockResolvedValueOnce(null);
            mockApi.getSkins.mockResolvedValueOnce(null);
            mockApi.getCompanions.mockResolvedValueOnce(null);

            await mgr.syncFromServer();

            expect(mgr.getInventory().mandarin).toBe(10);
        });

        it('로컬 인벤토리가 더 크면 로컬 값 유지 (서버보다 큰 로컬)', async () => {
            // 로컬: mandarin=20, 서버: mandarin=5 → 20 유지
            localStorage.setItem(LS_KEY_INVENTORY, JSON.stringify({ mandarin: 20, watermelon: 0, hotspring_material: 0 }));
            mockApi.getInventory.mockResolvedValueOnce({ mandarin: 5, watermelon: 0, hotspring_material: 0 });
            mockApi.getOnsenLayout.mockResolvedValueOnce(null);
            mockApi.getSkins.mockResolvedValueOnce(null);
            mockApi.getCompanions.mockResolvedValueOnce(null);

            await mgr.syncFromServer();

            expect(mgr.getInventory().mandarin).toBe(20);
        });

        it('getInventory 실패(rejected) 시 로컬 인벤토리 변경 없음', async () => {
            localStorage.setItem(LS_KEY_INVENTORY, JSON.stringify({ mandarin: 7, watermelon: 2, hotspring_material: 1 }));
            mockApi.getInventory.mockRejectedValueOnce(new Error('network error'));
            mockApi.getOnsenLayout.mockResolvedValueOnce(null);
            mockApi.getSkins.mockResolvedValueOnce(null);
            mockApi.getCompanions.mockResolvedValueOnce(null);

            await mgr.syncFromServer();

            const inv = mgr.getInventory();
            expect(inv.mandarin).toBe(7);
            expect(inv.watermelon).toBe(2);
            expect(inv.hotspring_material).toBe(1);
        });

        it('일부만 실패해도 성공한 항목은 정상 반영 (onsenLayout만 성공)', async () => {
            const layoutJson = JSON.stringify({ placedItems: [{ itemType: 'mandarin', x: 100, y: 200 }] });
            mockApi.getInventory.mockRejectedValueOnce(new Error('fail'));
            mockApi.getOnsenLayout.mockResolvedValueOnce(layoutJson);
            mockApi.getSkins.mockRejectedValueOnce(new Error('fail'));
            mockApi.getCompanions.mockRejectedValueOnce(new Error('fail'));

            await mgr.syncFromServer();

            // 인벤토리는 변경 없음 (기본값 0)
            expect(mgr.getInventory()).toEqual({ mandarin: 0, watermelon: 0, hotspring_material: 0, gem: 0 });
            // 온센 레이아웃은 반영됨
            const layout = mgr.getOnsenLayout();
            expect(layout.placedItems).toHaveLength(1);
        });

        it('전체 API 실패 시 syncFromServer는 예외를 던지지 않음 (Promise.allSettled 보장)', async () => {
            mockApi.getInventory.mockRejectedValueOnce(new Error('fail'));
            mockApi.getOnsenLayout.mockRejectedValueOnce(new Error('fail'));
            mockApi.getSkins.mockRejectedValueOnce(new Error('fail'));
            mockApi.getCompanions.mockRejectedValueOnce(new Error('fail'));

            await expect(mgr.syncFromServer()).resolves.toBeUndefined();
        });

        it('getSkins 성공 시 selectedSkin localStorage에 반영됨', async () => {
            mockApi.getInventory.mockResolvedValueOnce(null);
            mockApi.getOnsenLayout.mockResolvedValueOnce(null);
            mockApi.getSkins.mockResolvedValueOnce({ selected_skin: 'towel', unlocked_skins: '["default","towel"]' });
            mockApi.getCompanions.mockResolvedValueOnce(null);

            await mgr.syncFromServer();

            expect(mgr.getSelectedSkin()).toBe('towel');
        });
    });

    describe('gem currency', () => {
        it('getGems returns 0 when empty', () => {
            expect(mgr.getGems()).toBe(0);
        });

        it('addGems increases gem count', () => {
            mgr.addGems(10);
            expect(mgr.getGems()).toBe(10);
        });

        it('addGems accumulates across calls', () => {
            mgr.addGems(5);
            mgr.addGems(3);
            expect(mgr.getGems()).toBe(8);
        });

        it('spendGems returns true and deducts when sufficient', () => {
            mgr.addGems(10);
            const result = mgr.spendGems(7);
            expect(result).toBe(true);
            expect(mgr.getGems()).toBe(3);
        });

        it('spendGems returns false when insufficient', () => {
            mgr.addGems(5);
            const result = mgr.spendGems(10);
            expect(result).toBe(false);
            expect(mgr.getGems()).toBe(5);
        });

        it('spendGems returns false when zero balance', () => {
            const result = mgr.spendGems(1);
            expect(result).toBe(false);
            expect(mgr.getGems()).toBe(0);
        });

        it('gem is included in getInventory default', () => {
            const inv = mgr.getInventory();
            expect(inv).toHaveProperty('gem');
            expect(inv.gem).toBe(0);
        });
    });

});
