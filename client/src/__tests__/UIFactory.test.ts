import { describe, it, expect } from 'vitest';
import type { ButtonConfig } from '../ui/UIFactory';

/**
 * UIFactory 순수 로직 테스트.
 *
 * createButton, fadeToScene 등은 Phaser Scene 의존성 때문에 직접 호출이 어렵다.
 * 여기서는 ButtonConfig 타입 유효성 검사 로직을 모방하여
 * 필수/선택 필드의 기본값 규칙을 문서화하는 테스트를 작성한다.
 */

// ── ButtonConfig 기본값 규칙 (UIFactory.createButton 구현과 일치) ──────

const DEFAULT_BUTTON_WIDTH = 240;
const DEFAULT_BUTTON_HEIGHT = 56;
const DEFAULT_FONT_SIZE = '26px';
const DEFAULT_RADIUS = 14;

/** createButton 내부와 동일한 기본값 적용 로직 */
function applyButtonDefaults(config: ButtonConfig) {
    return {
        width: config.width ?? DEFAULT_BUTTON_WIDTH,
        height: config.height ?? DEFAULT_BUTTON_HEIGHT,
        fontSize: config.fontSize ?? DEFAULT_FONT_SIZE,
        radius: config.radius ?? DEFAULT_RADIUS,
    };
}

/** ButtonConfig 필수 필드 검증 */
function isValidButtonConfig(config: Partial<ButtonConfig>): config is ButtonConfig {
    return (
        typeof config.x === 'number' &&
        typeof config.y === 'number' &&
        typeof config.label === 'string' && config.label.length > 0 &&
        typeof config.color === 'number' &&
        typeof config.callback === 'function'
    );
}

describe('UIFactory — ButtonConfig 기본값', () => {
    it('width 미지정 시 240 적용', () => {
        const result = applyButtonDefaults({ x: 0, y: 0, label: '버튼', color: 0, callback: () => {} });
        expect(result.width).toBe(240);
    });

    it('height 미지정 시 56 적용', () => {
        const result = applyButtonDefaults({ x: 0, y: 0, label: '버튼', color: 0, callback: () => {} });
        expect(result.height).toBe(56);
    });

    it('fontSize 미지정 시 "26px" 적용', () => {
        const result = applyButtonDefaults({ x: 0, y: 0, label: '버튼', color: 0, callback: () => {} });
        expect(result.fontSize).toBe('26px');
    });

    it('radius 미지정 시 14 적용', () => {
        const result = applyButtonDefaults({ x: 0, y: 0, label: '버튼', color: 0, callback: () => {} });
        expect(result.radius).toBe(14);
    });

    it('커스텀 width/height 지정 시 해당 값 사용', () => {
        const result = applyButtonDefaults({ x: 0, y: 0, label: '확인', color: 0, callback: () => {}, width: 320, height: 72 });
        expect(result.width).toBe(320);
        expect(result.height).toBe(72);
    });

    it('커스텀 fontSize/radius 지정 시 해당 값 사용', () => {
        const result = applyButtonDefaults({ x: 0, y: 0, label: '확인', color: 0, callback: () => {}, fontSize: '32px', radius: 20 });
        expect(result.fontSize).toBe('32px');
        expect(result.radius).toBe(20);
    });
});

describe('UIFactory — ButtonConfig 유효성 검사', () => {
    it('모든 필수 필드가 있으면 유효', () => {
        const config: Partial<ButtonConfig> = {
            x: 360, y: 640, label: '시작', color: 0x4CAF50, callback: () => {},
        };
        expect(isValidButtonConfig(config)).toBe(true);
    });

    it('x가 없으면 유효하지 않음', () => {
        const config: Partial<ButtonConfig> = { y: 640, label: '시작', color: 0x4CAF50, callback: () => {} };
        expect(isValidButtonConfig(config)).toBe(false);
    });

    it('label이 빈 문자열이면 유효하지 않음', () => {
        const config: Partial<ButtonConfig> = { x: 0, y: 0, label: '', color: 0, callback: () => {} };
        expect(isValidButtonConfig(config)).toBe(false);
    });

    it('callback이 함수가 아니면 유효하지 않음', () => {
        const config: any = { x: 0, y: 0, label: '버튼', color: 0, callback: 'not-a-function' };
        expect(isValidButtonConfig(config)).toBe(false);
    });

    it('color가 0이어도 유효 (0x000000 검정)', () => {
        const config: Partial<ButtonConfig> = { x: 0, y: 0, label: '버튼', color: 0, callback: () => {} };
        expect(isValidButtonConfig(config)).toBe(true);
    });
});
