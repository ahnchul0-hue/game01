/** Pure-logic combo tracker — no Phaser dependency. */
export class ComboManager {
    private count = 0;
    private timer = 0;
    private static readonly TIMEOUT = 2000;
    private static readonly BONUS = [1, 1, 1.2, 1.5, 2.0];

    /** Tick down the combo window. Call once per frame with effective delta (ms). */
    update(delta: number): boolean {
        if (this.timer <= 0) return false;
        this.timer -= delta;
        if (this.timer <= 0) {
            this.count = 0;
            return true; // combo expired this frame
        }
        return false;
    }

    /** Register a collect hit. Returns the combo multiplier for this hit. */
    hit(): number {
        this.count++;
        this.timer = ComboManager.TIMEOUT;
        const idx = Math.min(this.count, ComboManager.BONUS.length - 1);
        return ComboManager.BONUS[idx];
    }

    getCount(): number { return this.count; }
    reset(): void { this.count = 0; this.timer = 0; }
}
