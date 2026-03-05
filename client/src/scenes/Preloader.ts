import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_PRELOADER,
    SCENE_MAIN_MENU,
    LS_KEY_SELECTED_SKIN,
} from '../utils/Constants';
import { ensureStageTextures, ensureSkinTexture } from '../utils/TextureUtils';
import { buildAllAtlases, ATLAS_GAME_KEY, ATLAS_UI_KEY } from '../utils/TextureAtlasBuilder';

export class Preloader extends Phaser.Scene {
    constructor() {
        super(SCENE_PRELOADER);
    }

    preload(): void {
        // 프로그레스바 UI
        const barW = 400;
        const barH = 30;
        const barX = (GAME_WIDTH - barW) / 2;
        const barY = GAME_HEIGHT / 2;

        const bgBar = this.add.graphics();
        bgBar.fillStyle(0x444444, 1);
        bgBar.fillRect(barX, barY, barW, barH);

        const fillBar = this.add.graphics();

        this.load.on('progress', (value: number) => {
            fillBar.clear();
            fillBar.fillStyle(0x44cc44, 1);
            fillBar.fillRect(barX, barY, barW * value, barH);
        });

        // 카피바라 스킨 PNG 로드 (assets/capybara-*.png)
        this.load.image('capybara-default', 'assets/capybara-default.png');
        this.load.image('capybara-towel',   'assets/capybara-towel.png');
        this.load.image('capybara-yukata',  'assets/capybara-yukata.png');
        this.load.image('capybara-santa',   'assets/capybara-santa.png');
    }

    create(): void {
        // 프로토타입 에셋: 코드 기반 텍스처 생성
        this.createPlaceholderTextures();

        // 최소 0.5초 표시 후 메뉴로 전환
        this.time.delayedCall(500, () => {
            this.scene.start(SCENE_MAIN_MENU);
        });
    }

    private createPlaceholderTextures(): void {
        // 레거시 2D 배경 텍스처는 의사-3D RoadRenderer가 대체하므로 생성하지 않음

        // ── D3: 텍스처 아틀라스 통합 ─────────────────────────────────
        // 장애물 6종 + 아이템 3종 + 파워업 4종 → atlas-game (512x512)
        // particle + friend-sprite + helmet-overlay + onsen-deco 3종 → atlas-ui (256x256)
        //
        // 개별 generateTexture() 18+회 → WebGL 텍스처 2장으로 통합.
        // 기존 키('obstacle-rock' 등)는 아틀라스 프레임 이름으로 유지되어
        // 모든 기존 코드가 수정 없이 동작합니다.
        //   - 아틀라스 내 프레임 접근: this.add.image(x, y, ATLAS_GAME_KEY, 'obstacle-rock')
        //   - 레거시 래퍼 주의: Image/Sprite setTexture 호출 시 두 번째 인자로 프레임명 전달 필요.
        //     → activateZ(), setTexture() 호출부는 아래 _applyAtlasTextures() 참조.
        buildAllAtlases(this);

        // 아틀라스 프레임 → 레거시 단일 텍스처 키 호환 레이어
        // 기존 코드(Obstacle.ts, Item.ts 등)가 `this.setTexture('obstacle-rock')` 형태로
        // 단일 키를 사용하므로, 아틀라스 프레임을 독립 텍스처로도 등록합니다.
        // 이로써 setTexture(key) / add.image(x, y, key) 두 방식 모두 동작합니다.
        this._registerAtlasFramesAsTextures(ATLAS_GAME_KEY);
        this._registerAtlasFramesAsTextures(ATLAS_UI_KEY);

        // M3: 스테이지 배경 — 시작 스테이지만 생성 (나머지는 StageManager에서 lazy 생성)
        ensureStageTextures(this, 'forest');

        // M4: 스킨 — 선택된 스킨만 생성 (나머지는 SkinSelect에서 lazy 생성)
        ensureSkinTexture(this, 'default');
        const selectedSkin = localStorage.getItem(LS_KEY_SELECTED_SKIN);
        if (selectedSkin && selectedSkin !== 'default') {
            ensureSkinTexture(this, selectedSkin as import('../utils/Constants').SkinId);
        }

        // (온천 배경은 Onsen Scene에서 Graphics로 직접 렌더링 — 데드 텍스처 제거됨)
    }

    /**
     * 아틀라스의 각 프레임을 독립 Texture 항목으로도 등록합니다.
     *
     * Phaser의 setTexture(key) / add.image(x, y, key) API는 TextureManager에서
     * 단일 키로 조회하므로, 아틀라스 프레임 이름을 독립 텍스처로 aliasing합니다.
     *
     * 구현: atlasTexture에서 각 프레임의 픽셀 영역을 참조하는 새 Texture를
     * 동일 source(ImageData)를 공유하는 방식으로 등록합니다.
     * → 추가 GPU 메모리 비용 없이 두 가지 접근 방식을 모두 지원합니다.
     *
     * [EXTEND] Phaser 버전 업그레이드 시 Texture.addFrame() API 변경 가능 — 확인 필요.
     */
    private _registerAtlasFramesAsTextures(atlasKey: string): void {
        const atlasTexture = this.textures.get(atlasKey);
        if (!atlasTexture) return;

        // 아틀라스의 '__BASE' 프레임을 제외한 모든 명명 프레임을 순회
        const frameNames = atlasTexture.getFrameNames(false);
        for (const frameName of frameNames) {
            // 이미 독립 텍스처로 등록된 키는 건너뜀
            if (this.textures.exists(frameName)) continue;

            const frame = atlasTexture.get(frameName);
            if (!frame) continue;

            // 아틀라스 소스 이미지를 공유하는 새 Texture 등록
            // source[0]은 RenderTexture의 WebGL 텍스처 소스
            const newTex = this.textures.addImage(frameName, frame.source.image as HTMLImageElement);
            if (newTex) {
                // 프레임 영역 제한: 아틀라스 내 해당 서브렉트만 사용하도록 프레임 추가
                newTex.add('__BASE', 0, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
            }
        }
    }

    // (스테이지 배경 텍스처는 TextureUtils.ensureStageTextures에서 lazy 생성)
    // (장애물/아이템/파워업/UI 텍스처는 TextureAtlasBuilder.buildAllAtlases에서 아틀라스로 생성)
}
