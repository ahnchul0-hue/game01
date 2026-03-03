import Phaser from 'phaser';
import { SWIPE_THRESHOLD } from '../utils/Constants';

export interface InputCallbacks {
    onMoveLeft(): void;
    onMoveRight(): void;
    onJump(): void;
    onSlide(): void;
    /** Return false to suppress input (e.g. game not in 'playing' state) */
    isInputActive(): boolean;
}

/**
 * Encapsulates keyboard + touch/swipe input for the Game scene.
 * Call pollKeyboard() from the scene's update() loop.
 */
export class InputController {
    private scene: Phaser.Scene;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
    private swipeStart: { x: number; y: number } | null = null;
    private callbacks: InputCallbacks;

    // Named references for clean removal
    private readonly onPointerDown: (p: Phaser.Input.Pointer) => void;
    private readonly onPointerUp: (p: Phaser.Input.Pointer) => void;

    constructor(scene: Phaser.Scene, callbacks: InputCallbacks) {
        this.scene = scene;
        this.callbacks = callbacks;

        // Keyboard
        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
        }

        // Named handler references (arrow functions bound to this)
        this.onPointerDown = (p: Phaser.Input.Pointer) => {
            if (!this.callbacks.isInputActive()) return;
            this.swipeStart = { x: p.x, y: p.y };
        };

        this.onPointerUp = (p: Phaser.Input.Pointer) => {
            if (!this.swipeStart || !this.callbacks.isInputActive()) return;
            const dx = p.x - this.swipeStart.x;
            const dy = p.y - this.swipeStart.y;

            if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) this.callbacks.onMoveRight();
                else this.callbacks.onMoveLeft();
            } else if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
                if (dy < 0) this.callbacks.onJump();
                else this.callbacks.onSlide();
            }

            this.swipeStart = null;
        };

        scene.input.on('pointerdown', this.onPointerDown);
        scene.input.on('pointerup', this.onPointerUp);
    }

    /** Call once per frame from update() to check keyboard state. */
    pollKeyboard(): void {
        if (!this.cursors || !this.callbacks.isInputActive()) return;

        if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.callbacks.onMoveLeft();
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.callbacks.onMoveRight();
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.callbacks.onJump();
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.callbacks.onSlide();
    }

    destroy(): void {
        this.scene.input.off('pointerdown', this.onPointerDown);
        this.scene.input.off('pointerup', this.onPointerUp);
        this.swipeStart = null;
    }
}
