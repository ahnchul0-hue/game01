import Phaser from 'phaser';
import type { Mission } from '../services/ApiClient';
import { ApiClient } from '../services/ApiClient';
import { InventoryManager } from '../services/InventoryManager';
import { SoundManager } from '../services/SoundManager';
import { FONT_FAMILY, GAME_WIDTH, GAME_HEIGHT, MISSION_LABELS } from '../utils/Constants';
import type { MissionType } from '../utils/Constants';

// ─── MissionCard 설정 ────────────────────────────────────────────────────────
export interface MissionCardConfig {
    /** 카드 세로 위치 */
    cardY: number;
    /** 로컬 캐시 업데이트 콜백 (보상 수령 후 캐시 갱신) */
    onRewardClaimed: (missionId: number) => void;
}

// ─── MissionCard 클래스 ──────────────────────────────────────────────────────
/**
 * 미션 1개를 렌더링하는 컨테이너 컴포넌트.
 * Phaser.GameObjects.Container 를 상속하여 Scene 의 displayList 에 직접 추가 가능.
 *
 * 포함 로직:
 *  - 카드 배경 (진행/완료/수령 상태별 색상)
 *  - 미션 라벨, 보상 텍스트
 *  - 진행도 바 + 수치 텍스트
 *  - "보상 받기" 버튼 (완료 & 미수령) / "수령 완료" 텍스트
 *  - 보상 수령 처리 (낙관적 UI 갱신 + 서버 fire-and-forget + 로컬 인벤토리 반영)
 *  - 보상 팝업 애니메이션
 */
export class MissionCard extends Phaser.GameObjects.Container {
    private readonly mission: Mission;
    private readonly config: MissionCardConfig;

    // 카드 레이아웃 상수
    private static readonly CARD_X_OFFSET = 310; // GAME_WIDTH/2 - CARD_X_OFFSET = 카드 좌측 x
    private static readonly CARD_W = 620;
    private static readonly CARD_H = 160;
    private static readonly CARD_RADIUS = 14;

    constructor(scene: Phaser.Scene, mission: Mission, config: MissionCardConfig) {
        super(scene, 0, 0);
        this.mission = mission;
        this.config = config;

        scene.add.existing(this);
        this.build();
    }

    // ─── 카드 전체 빌드 ──────────────────────────────────────────────────────
    private build(): void {
        const { cardY } = this.config;
        const cardX = GAME_WIDTH / 2 - MissionCard.CARD_X_OFFSET;
        const cardW = MissionCard.CARD_W;
        const cardH = MissionCard.CARD_H;

        const mission = this.mission;
        const isCompleted = mission.completed === 1;
        const isClaimed = mission.reward_claimed === 1;

        // ── 카드 배경 ──────────────────────────────────────────────────────
        const cardBg = this.scene.add.graphics();
        let bgColor: number;
        if (isClaimed) {
            bgColor = 0x2A2A2A; // 수령 완료 — 어두운 회색
        } else if (isCompleted) {
            bgColor = 0x3A3A1A; // 완료 미수령 — 어두운 골드 배경
        } else {
            bgColor = 0x1E2A3A; // 진행 중 — 어두운 파랑
        }
        cardBg.fillStyle(bgColor, 1);
        cardBg.fillRoundedRect(cardX, cardY, cardW, cardH, MissionCard.CARD_RADIUS);

        // 완료 테두리
        if (isCompleted && !isClaimed) {
            const border = this.scene.add.graphics();
            border.lineStyle(2, 0xFFD700, 1);
            border.strokeRoundedRect(cardX, cardY, cardW, cardH, MissionCard.CARD_RADIUS);
            this.add(border);
        }
        this.add(cardBg);

        // ── 미션 라벨 ──────────────────────────────────────────────────────
        const label = MISSION_LABELS[mission.mission_type as MissionType] ?? mission.mission_type;
        const labelColor = isClaimed ? '#666666' : '#FFFFFF';
        const labelText = this.scene.add.text(cardX + 20, cardY + 18, label, {
            fontFamily: FONT_FAMILY,
            fontSize: '22px',
            color: labelColor,
            fontStyle: 'bold',
        });
        this.add(labelText);

        // ── 보상 텍스트 ────────────────────────────────────────────────────
        const rewardLabel = this.getRewardLabel(mission.reward_type);
        const rewardStr = `보상: ${rewardLabel} x${mission.reward_amount}`;
        const rewardColor = isClaimed ? '#555555' : '#FFD700';
        const rewardText = this.scene.add.text(cardX + 20, cardY + 48, rewardStr, {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            color: rewardColor,
        });
        this.add(rewardText);

        // ── 진행도 바 ──────────────────────────────────────────────────────
        const barX = cardX + 20;
        const barY = cardY + 84;
        const barW = isClaimed ? 340 : 300;
        const barH = 20;
        const progress = Math.min(mission.current_value / Math.max(mission.target_value, 1), 1);

        // 배경 바
        const barBg = this.scene.add.graphics();
        barBg.fillStyle(0x111111, 1);
        barBg.fillRoundedRect(barX, barY, barW, barH, 8);
        this.add(barBg);

        // 진행 바
        const barFill = this.scene.add.graphics();
        if (progress > 0) {
            const fillColor = isClaimed ? 0x444444 : isCompleted ? 0xFFD700 : 0x4CAF50;
            barFill.fillStyle(fillColor, 1);
            barFill.fillRoundedRect(barX, barY, Math.floor(barW * progress), barH, 8);
        }
        this.add(barFill);

        // 진행도 수치 텍스트
        const progressStr = `${mission.current_value} / ${mission.target_value}`;
        const progressColor = isClaimed ? '#555555' : '#AAAAAA';
        const progressText = this.scene.add.text(barX + barW / 2, barY + barH / 2, progressStr, {
            fontFamily: FONT_FAMILY,
            fontSize: '14px',
            color: progressColor,
        }).setOrigin(0.5, 0.5);
        this.add(progressText);

        // 진행도 % 텍스트
        const pctStr = `${Math.floor(progress * 100)}%`;
        const pctText = this.scene.add.text(barX + barW + 10, barY + barH / 2, pctStr, {
            fontFamily: FONT_FAMILY,
            fontSize: '14px',
            color: isClaimed ? '#555555' : '#AAAAAA',
        }).setOrigin(0, 0.5);
        this.add(pctText);

        // ── 보상 받기 버튼 / 수령 완료 텍스트 ──────────────────────────────
        if (isCompleted && !isClaimed) {
            this.addClaimButton(
                cardX, cardY, cardW, cardH,
                barFill, progressText, pctText, rewardText, labelText,
            );
        } else if (isClaimed) {
            const doneText = this.scene.add.text(
                cardX + cardW - 95,
                cardY + cardH / 2,
                '수령 완료',
                {
                    fontFamily: FONT_FAMILY,
                    fontSize: '18px',
                    color: '#555555',
                },
            ).setOrigin(0.5);
            this.add(doneText);
        }
    }

    // ─── "보상 받기" 버튼 생성 ────────────────────────────────────────────────
    private addClaimButton(
        cardX: number,
        cardY: number,
        cardW: number,
        cardH: number,
        barFill: Phaser.GameObjects.Graphics,
        progressText: Phaser.GameObjects.Text,
        pctText: Phaser.GameObjects.Text,
        rewardText: Phaser.GameObjects.Text,
        labelText: Phaser.GameObjects.Text,
    ): void {
        const btnX = cardX + cardW - 100;
        const btnY = cardY + cardH / 2;
        const btnW = 140;
        const btnH = 44;

        const claimBg = this.scene.add.graphics();
        claimBg.fillStyle(0xFFD700, 1);
        claimBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 10);
        this.add(claimBg);

        const claimLabel = this.scene.add.text(btnX, btnY, '보상 받기', {
            fontFamily: FONT_FAMILY,
            fontSize: '18px',
            color: '#1A1A00',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add(claimLabel);

        const claimZone = this.scene.add.zone(btnX, btnY, btnW, btnH)
            .setInteractive({ useHandCursor: true });
        this.add(claimZone);

        claimZone.on('pointerdown', () => {
            SoundManager.getInstance().playSfx('button');
            this.onClaimMissionReward(claimBg, claimLabel, claimZone, barFill, progressText, pctText, rewardText, labelText);
        });

        // 골드 펄싱 글로우
        this.scene.tweens.add({
            targets: claimLabel,
            alpha: 0.5,
            duration: 600,
            yoyo: true,
            repeat: -1,
        });
    }

    // ─── 미션 보상 수령 처리 ──────────────────────────────────────────────────
    private onClaimMissionReward(
        claimBg: Phaser.GameObjects.Graphics,
        claimLabel: Phaser.GameObjects.Text,
        claimZone: Phaser.GameObjects.Zone,
        barFill: Phaser.GameObjects.Graphics,
        progressText: Phaser.GameObjects.Text,
        pctText: Phaser.GameObjects.Text,
        rewardText: Phaser.GameObjects.Text,
        labelText: Phaser.GameObjects.Text,
    ): void {
        const mission = this.mission;

        // 즉시 UI 반영 (낙관적 업데이트)
        mission.reward_claimed = 1;
        claimZone.disableInteractive();

        claimBg.setAlpha(0.3);
        claimLabel.setText('수령 완료');
        claimLabel.setStyle({ color: '#999999' });
        this.scene.tweens.killTweensOf(claimLabel);
        claimLabel.setAlpha(1);

        barFill.setAlpha(0.3);
        progressText.setStyle({ color: '#555555' });
        pctText.setStyle({ color: '#555555' });
        rewardText.setStyle({ color: '#555555' });
        labelText.setStyle({ color: '#666666' });

        // 로컬 캐시 업데이트 (Missions.ts 에 위임)
        this.config.onRewardClaimed(mission.id);

        // 서버 업데이트 (fire-and-forget)
        ApiClient.getInstance().claimMissionReward(mission.id);

        // 로컬 인벤토리에 보상 반영
        const rewardItems = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
        const rewardType = mission.reward_type as keyof typeof rewardItems;
        if (rewardType in rewardItems) {
            rewardItems[rewardType] = mission.reward_amount;
        }
        InventoryManager.getInstance().addItems(rewardItems);

        // 보상 팝업 텍스트
        const rewardLabel = this.getRewardLabel(mission.reward_type);
        this.showRewardPopup(`+${rewardLabel} x${mission.reward_amount}`);
    }

    // ─── 보상 팝업 애니메이션 ────────────────────────────────────────────────
    private showRewardPopup(text: string): void {
        const popup = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, text, {
            fontFamily: FONT_FAMILY,
            fontSize: '28px',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(500);
        this.add(popup);

        this.scene.tweens.add({
            targets: popup,
            y: popup.y - 80,
            alpha: 0,
            duration: 1200,
            ease: 'Power2',
            onComplete: () => popup.destroy(),
        });
    }

    // ─── 헬퍼 ────────────────────────────────────────────────────────────────
    private getRewardLabel(rewardType: string): string {
        if (rewardType === 'mandarin') return '귤';
        if (rewardType === 'watermelon') return '수박';
        return '온천 재료';
    }
}
