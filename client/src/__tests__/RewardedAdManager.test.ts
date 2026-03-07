import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RewardedAdManager } from '../services/RewardedAdManager';

describe('RewardedAdManager', () => {
    beforeEach(() => {
        // Reset singleton for isolation
        (RewardedAdManager as any).instance = undefined;
    });

    it('getInstance returns singleton', () => {
        const a = RewardedAdManager.getInstance();
        const b = RewardedAdManager.getInstance();
        expect(a).toBe(b);
    });

    it('isAdReady returns true (placeholder)', () => {
        const mgr = RewardedAdManager.getInstance();
        expect(mgr.isAdReady('revive')).toBe(true);
        expect(mgr.isAdReady('doubleReward')).toBe(true);
    });

    it('showAd calls callback with true after delay', async () => {
        vi.useFakeTimers();
        const mgr = RewardedAdManager.getInstance();
        const callback = vi.fn();

        mgr.showAd('revive', callback);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalledWith(true);
        expect(callback).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('showAd with doubleReward type works the same', async () => {
        vi.useFakeTimers();
        const mgr = RewardedAdManager.getInstance();
        const callback = vi.fn();

        mgr.showAd('doubleReward', callback);
        vi.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalledWith(true);

        vi.useRealTimers();
    });
});
