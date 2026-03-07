/**
 * RewardedAdManager — 보상형 광고 인프라
 *
 * 실제 광고 SDK(AdMob 등) 연동 전 placeholder 구현.
 * SDK 키 발급 후 showAd()에 실제 로직을 연결하면 됩니다.
 */

type AdType = 'revive' | 'doubleReward';
type AdCallback = (success: boolean) => void;

export class RewardedAdManager {
    private static instance: RewardedAdManager;
    private adReady = true; // placeholder: 항상 준비됨

    static getInstance(): RewardedAdManager {
        if (!RewardedAdManager.instance) {
            RewardedAdManager.instance = new RewardedAdManager();
        }
        return RewardedAdManager.instance;
    }

    /** 광고 준비 여부 */
    isAdReady(_type: AdType): boolean {
        return this.adReady;
    }

    /**
     * 보상형 광고를 표시합니다.
     * placeholder: 1초 대기 후 항상 성공 콜백.
     * 실제 SDK 연동 시 이 메서드만 교체하면 됩니다.
     */
    showAd(type: AdType, callback: AdCallback): void {
        console.log(`[RewardedAd] Showing ${type} ad (placeholder)`);

        // TODO: 실제 AdMob/AdSense SDK 연동
        // window.admob?.showRewardedAd({ adId: AD_UNIT_IDS[type] })
        //   .then(() => callback(true))
        //   .catch(() => callback(false));

        // placeholder: simulate ad view
        setTimeout(() => {
            callback(true);
        }, 1000);
    }
}
