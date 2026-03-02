import Phaser from 'phaser';
import { SCENE_BOOT, SCENE_PRELOADER } from '../utils/Constants';

export class Boot extends Phaser.Scene {
    constructor() {
        super(SCENE_BOOT);
    }

    preload(): void {
        // 프로토타입: 에셋 없이 바로 통과
        // 실제 에셋 적용 시 로딩 바 이미지를 여기서 로드
    }

    create(): void {
        this.scene.start(SCENE_PRELOADER);
    }
}
