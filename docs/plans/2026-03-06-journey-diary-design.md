# Journey Diary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collectible "Journey Diary" feature — 10 distance-milestone entries with procedural illustrations and narrative text, unlocked by maxDistance.

**Architecture:** Pure client-side feature. Data model is a static constant array; unlock is computed from `InventoryManager.getMaxDistance()`. New Scene with scrollable card timeline, registered in main.ts and linked from MainMenu.

**Tech Stack:** Phaser 3 (3.90.0), TypeScript, Vitest, existing UIFactory/createButton pattern.

---

# Journey Diary Design

## Overview
Collectible content feature for Capybara Runner. Players unlock diary entries by reaching distance milestones. Each entry shows a procedural mini-illustration, a stage title, and a short story text about the capybara's journey to find hot springs.

## Goals
- Strengthen the "healing journey" narrative differentiation
- Give players collection motivation beyond score/items
- Zero server changes (client-only, maxDistance-based auto-unlock)

## Data Model

```typescript
interface DiaryEntry {
    id: number;
    distance: number;       // unlock threshold (meters)
    title: string;          // entry title (Korean)
    story: string;          // narrative text (Korean)
    stage: StageType;       // background color palette
}

// 10 entries, unlocked when player's maxDistance >= entry.distance
const DIARY_ENTRIES: DiaryEntry[] = [
    { id: 1,  distance: 0,     title: '출발',       story: '카피바라가 온천을 찾아 첫 발을 내딛습니다', stage: 'forest' },
    { id: 2,  distance: 100,   title: '첫 모험',     story: '숲속의 향기가 카피바라를 이끕니다', stage: 'forest' },
    { id: 3,  distance: 500,   title: '숲의 깊이',   story: '나무 사이로 빛이 쏟아집니다', stage: 'forest' },
    { id: 4,  distance: 1000,  title: '강가 도착',   story: '시원한 강물 소리가 들려옵니다', stage: 'river' },
    { id: 5,  distance: 2000,  title: '다리 건너기',  story: '오래된 다리 위에서 멀리 마을이 보입니다', stage: 'river' },
    { id: 6,  distance: 3000,  title: '마을 입구',   story: '따뜻한 마을 사람들이 반겨줍니다', stage: 'village' },
    { id: 7,  distance: 5000,  title: '온천 냄새',   story: '유황 냄새가 코를 간지럽힙니다', stage: 'village' },
    { id: 8,  distance: 6000,  title: '온천 도착',   story: '드디어 꿈에 그리던 온천!', stage: 'onsen' },
    { id: 9,  distance: 8000,  title: '두 번째 여정', story: '새로운 온천을 찾아 다시 떠납니다', stage: 'forest' },
    { id: 10, distance: 10000, title: '전설의 온천',  story: '전설 속 황금 온천의 소문을 따라...', stage: 'onsen' },
];
```

## Unlock Logic
- `maxDistance` from `InventoryManager.getMaxDistance()` (already persisted in localStorage)
- Entry is unlocked when `maxDistance >= entry.distance`
- No separate unlock state storage needed (pure computed)
- Progress percentage: `Math.min(1, maxDistance / entry.distance)`

## UI: JourneyDiary Scene

### Layout
- Vertical timeline (scrollable if entries exceed screen)
- Each card: 140px height, 640px width (centered in 720px game)
- Card gap: 16px
- Header: "Journey Diary" title + back button (top)

### Card Design (unlocked)
- Left: 120x120 procedural mini-illustration (Phaser Graphics)
- Right side:
  - Title (bold, 22px)
  - Story text (16px, warm color)
  - Distance badge: "1000m" (small, bottom-right)
- Background: stage-colored gradient (STAGE_COLORS palette)
- Border: subtle rounded rect

### Card Design (locked)
- Gray background (0x888888)
- Lock icon (from atlas)
- Title: "???"
- Progress bar at bottom (percentage to unlock distance)

### Procedural Illustrations (Phaser Graphics)
Each illustration is a simple 120x120 scene drawn with Graphics:
- **forest**: Green trees (triangles) + brown ground + blue sky
- **river**: Blue wavy lines + bridge (rect) + distant mountain
- **village**: Houses (rects) + chimney smoke (circles) + path
- **onsen**: Steam circles + water pool (ellipse) + capybara silhouette

### Navigation
- MainMenu: Add "Diary" button in the existing 2-column grid
- JourneyDiary Scene: back button returns to MainMenu via UIFactory.fadeToScene

### Scroll
- Phaser camera scroll (container approach)
- Total content height = (card count * (140 + 16)) + header
- Drag/touch scroll with bounds clamping

## Files to Create/Modify

### New Files
1. `client/src/utils/DiaryData.ts` — DIARY_ENTRIES constant + DiaryEntry type
2. `client/src/scenes/JourneyDiary.ts` — Scene with timeline UI
3. `client/src/ui/DiaryCard.ts` — Individual card component
4. `client/src/ui/DiaryIllustration.ts` — Procedural illustration renderer

### Modified Files
5. `client/src/scenes/MainMenu.ts` — Add "Diary" button
6. `client/src/main.ts` — Register JourneyDiary scene
7. `client/src/utils/Constants.ts` — Add SCENE_JOURNEY_DIARY constant

## Testing
- Unit test: `DiaryData.test.ts` — entries sorted by distance, all required fields present
- Unit test: unlock logic — maxDistance-based unlock computation
- Manual: visual verification via Playwright screenshot

## Non-Goals
- No server API (pure client-side)
- No user-editable diary entries
- No social sharing of diary (future consideration)
- No animation/transition between diary entries

---

# Implementation Plan

## Task 1: DiaryData + Tests

**Files:**
- Create: `client/src/utils/DiaryData.ts`
- Create: `client/src/__tests__/DiaryData.test.ts`

**Step 1: Write DiaryData.ts**

```typescript
// client/src/utils/DiaryData.ts
import type { StageType } from './Constants';

export interface DiaryEntry {
    id: number;
    distance: number;
    title: string;
    story: string;
    stage: StageType;
}

export const DIARY_ENTRIES: DiaryEntry[] = [
    { id: 1,  distance: 0,     title: '출발',       story: '카피바라가 온천을 찾아 첫 발을 내딛습니다', stage: 'forest' },
    { id: 2,  distance: 100,   title: '첫 모험',     story: '숲속의 향기가 카피바라를 이끕니다', stage: 'forest' },
    { id: 3,  distance: 500,   title: '숲의 깊이',   story: '나무 사이로 빛이 쏟아집니다', stage: 'forest' },
    { id: 4,  distance: 1000,  title: '강가 도착',   story: '시원한 강물 소리가 들려옵니다', stage: 'river' },
    { id: 5,  distance: 2000,  title: '다리 건너기',  story: '오래된 다리 위에서 멀리 마을이 보입니다', stage: 'river' },
    { id: 6,  distance: 3000,  title: '마을 입구',   story: '따뜻한 마을 사람들이 반겨줍니다', stage: 'village' },
    { id: 7,  distance: 5000,  title: '온천 냄새',   story: '유황 냄새가 코를 간지럽힙니다', stage: 'village' },
    { id: 8,  distance: 6000,  title: '온천 도착',   story: '드디어 꿈에 그리던 온천!', stage: 'onsen' },
    { id: 9,  distance: 8000,  title: '두 번째 여정', story: '새로운 온천을 찾아 다시 떠납니다', stage: 'forest' },
    { id: 10, distance: 10000, title: '전설의 온천',  story: '전설 속 황금 온천의 소문을 따라...', stage: 'onsen' },
];

/** Get unlocked entries count for a given maxDistance */
export function getUnlockedCount(maxDistance: number): number {
    return DIARY_ENTRIES.filter(e => maxDistance >= e.distance).length;
}

/** Get unlock progress (0~1) for a specific entry */
export function getEntryProgress(entry: DiaryEntry, maxDistance: number): number {
    if (entry.distance === 0) return 1;
    return Math.min(1, maxDistance / entry.distance);
}
```

**Step 2: Write tests**

```typescript
// client/src/__tests__/DiaryData.test.ts
import { describe, it, expect } from 'vitest';
import { DIARY_ENTRIES, getUnlockedCount, getEntryProgress } from '../utils/DiaryData';

describe('DiaryData', () => {
    it('has 10 entries', () => {
        expect(DIARY_ENTRIES).toHaveLength(10);
    });

    it('entries are sorted by distance ascending', () => {
        for (let i = 1; i < DIARY_ENTRIES.length; i++) {
            expect(DIARY_ENTRIES[i].distance).toBeGreaterThanOrEqual(DIARY_ENTRIES[i - 1].distance);
        }
    });

    it('all entries have required fields', () => {
        for (const entry of DIARY_ENTRIES) {
            expect(entry.id).toBeGreaterThan(0);
            expect(entry.distance).toBeGreaterThanOrEqual(0);
            expect(entry.title.length).toBeGreaterThan(0);
            expect(entry.story.length).toBeGreaterThan(0);
            expect(['forest', 'river', 'village', 'onsen']).toContain(entry.stage);
        }
    });

    it('IDs are unique', () => {
        const ids = DIARY_ENTRIES.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('first entry unlocks at 0m', () => {
        expect(DIARY_ENTRIES[0].distance).toBe(0);
    });

    describe('getUnlockedCount', () => {
        it('returns 1 for 0m (first entry always unlocked)', () => {
            expect(getUnlockedCount(0)).toBe(1);
        });

        it('returns 3 for 500m', () => {
            expect(getUnlockedCount(500)).toBe(3);
        });

        it('returns 10 for 10000m', () => {
            expect(getUnlockedCount(10000)).toBe(10);
        });

        it('returns 10 for distance beyond max', () => {
            expect(getUnlockedCount(99999)).toBe(10);
        });
    });

    describe('getEntryProgress', () => {
        it('returns 1 for distance=0 entry', () => {
            expect(getEntryProgress(DIARY_ENTRIES[0], 0)).toBe(1);
        });

        it('returns 0.5 for halfway', () => {
            expect(getEntryProgress(DIARY_ENTRIES[3], 500)).toBe(0.5); // 500/1000
        });

        it('clamps at 1', () => {
            expect(getEntryProgress(DIARY_ENTRIES[1], 9999)).toBe(1);
        });
    });
});
```

**Step 3: Run tests**

Run: `cd /home/cc2/game01/client && npx vitest run src/__tests__/DiaryData.test.ts`
Expected: PASS (all tests)

**Step 4: Commit**

```bash
git add client/src/utils/DiaryData.ts client/src/__tests__/DiaryData.test.ts
git commit -m "feat: DiaryData 모델 + 해금 로직 + 테스트 13건"
```

---

## Task 2: DiaryIllustration (procedural mini-scenes)

**Files:**
- Create: `client/src/ui/DiaryIllustration.ts`

**Step 1: Write DiaryIllustration.ts**

A utility that draws a 120x120 procedural landscape on a Phaser.GameObjects.Graphics for each StageType. Uses `STAGE_COLORS` for palette consistency.

```typescript
// client/src/ui/DiaryIllustration.ts
import Phaser from 'phaser';
import { STAGE_COLORS } from '../utils/Constants';
import type { StageType } from '../utils/Constants';

const SIZE = 120;

export function drawDiaryIllustration(scene: Phaser.Scene, x: number, y: number, stage: StageType): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    const colors = STAGE_COLORS[stage];

    // Sky
    g.fillStyle(colors.sky, 1);
    g.fillRect(x, y, SIZE, SIZE);

    // Ground
    g.fillStyle(colors.ground, 1);
    g.fillRect(x, y + 85, SIZE, 35);

    switch (stage) {
        case 'forest': drawForest(g, x, y, colors); break;
        case 'river':  drawRiver(g, x, y, colors);  break;
        case 'village': drawVillage(g, x, y, colors); break;
        case 'onsen':  drawOnsen(g, x, y, colors);  break;
    }

    return g;
}

function drawForest(g: Phaser.GameObjects.Graphics, x: number, y: number, c: { trees: number }): void {
    // Trees (triangles)
    for (const tx of [20, 50, 80, 105]) {
        const h = 30 + Math.abs(tx - 60) * 0.3;
        g.fillStyle(c.trees, 1);
        g.fillTriangle(x + tx, y + 85 - h, x + tx - 12, y + 85, x + tx + 12, y + 85);
        g.fillStyle(0x5D4037, 1);
        g.fillRect(x + tx - 2, y + 80, 4, 5);
    }
}

function drawRiver(g: Phaser.GameObjects.Graphics, x: number, y: number, c: { trees: number }): void {
    // Water
    g.fillStyle(0x4FC3F7, 0.7);
    g.fillRect(x, y + 70, SIZE, 15);
    // Bridge
    g.fillStyle(0x795548, 1);
    g.fillRect(x + 30, y + 65, 60, 8);
    g.fillRect(x + 35, y + 58, 4, 12);
    g.fillRect(x + 81, y + 58, 4, 12);
    // Mountain
    g.fillStyle(c.trees, 0.5);
    g.fillTriangle(x + 90, y + 25, x + 60, y + 70, x + 120, y + 70);
}

function drawVillage(g: Phaser.GameObjects.Graphics, x: number, y: number, _c: { trees: number }): void {
    // Houses
    for (const hx of [20, 60, 95]) {
        g.fillStyle(0xFFCC80, 1);
        g.fillRect(x + hx - 12, y + 60, 24, 25);
        // Roof
        g.fillStyle(0xD84315, 1);
        g.fillTriangle(x + hx, y + 48, x + hx - 16, y + 60, x + hx + 16, y + 60);
    }
    // Path
    g.fillStyle(0xBCAAA4, 1);
    g.fillRect(x + 10, y + 88, 100, 8);
}

function drawOnsen(g: Phaser.GameObjects.Graphics, x: number, y: number, _c: { trees: number }): void {
    // Water pool
    g.fillStyle(0x80DEEA, 0.8);
    g.fillEllipse(x + 60, y + 75, 80, 30);
    // Steam
    g.fillStyle(0xFFFFFF, 0.3);
    for (const [sx, sy, r] of [[40, 50, 8], [60, 40, 10], [80, 45, 7], [55, 30, 6]] as const) {
        g.fillCircle(x + sx, y + sy, r);
    }
    // Capybara silhouette
    g.fillStyle(0x795548, 0.8);
    g.fillEllipse(x + 60, y + 70, 16, 10);
    g.fillCircle(x + 68, y + 64, 6);
}
```

**Step 2: tsc check**

Run: `cd /home/cc2/game01/client && npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add client/src/ui/DiaryIllustration.ts
git commit -m "feat: DiaryIllustration 프로시저럴 미니 풍경 4종"
```

---

## Task 3: DiaryCard UI component

**Files:**
- Create: `client/src/ui/DiaryCard.ts`

**Step 1: Write DiaryCard.ts**

Each card: 640x140, stage-colored bg for unlocked / gray for locked. Uses DiaryIllustration on the left, text on the right.

```typescript
// client/src/ui/DiaryCard.ts
import Phaser from 'phaser';
import { STAGE_COLORS, FONT_FAMILY } from '../utils/Constants';
import type { DiaryEntry } from '../utils/DiaryData';
import { getEntryProgress } from '../utils/DiaryData';
import { drawDiaryIllustration } from './DiaryIllustration';
import { ATLAS_UI_KEY } from '../utils/TextureAtlasBuilder';

const CARD_W = 640;
const CARD_H = 140;
const ILLUST_SIZE = 120;
const ILLUST_PAD = 10;

export class DiaryCard {
    private objects: Phaser.GameObjects.GameObject[] = [];

    constructor(scene: Phaser.Scene, entry: DiaryEntry, x: number, y: number, maxDistance: number) {
        const unlocked = maxDistance >= entry.distance;
        const progress = getEntryProgress(entry, maxDistance);

        // Card background
        const bg = scene.add.graphics();
        const bgColor = unlocked ? STAGE_COLORS[entry.stage].sky : 0x888888;
        bg.fillStyle(bgColor, unlocked ? 0.85 : 0.5);
        bg.fillRoundedRect(x, y, CARD_W, CARD_H, 12);
        bg.lineStyle(2, unlocked ? 0xFFFFFF : 0x666666, 0.4);
        bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 12);
        this.objects.push(bg);

        if (unlocked) {
            // Illustration
            const illust = drawDiaryIllustration(scene, x + ILLUST_PAD, y + ILLUST_PAD, entry.stage);
            this.objects.push(illust);

            // Title
            const title = scene.add.text(x + ILLUST_SIZE + 24, y + 16, entry.title, {
                fontFamily: FONT_FAMILY, fontSize: '22px', color: '#FFFFFF',
                fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
            });
            this.objects.push(title);

            // Story
            const story = scene.add.text(x + ILLUST_SIZE + 24, y + 50, entry.story, {
                fontFamily: FONT_FAMILY, fontSize: '16px', color: '#FFE0B2',
                stroke: '#000000', strokeThickness: 2,
                wordWrap: { width: CARD_W - ILLUST_SIZE - 50 },
            });
            this.objects.push(story);

            // Distance badge
            const badge = scene.add.text(x + CARD_W - 16, y + CARD_H - 16, `${entry.distance}m`, {
                fontFamily: FONT_FAMILY, fontSize: '13px', color: '#BBBBBB',
                stroke: '#000000', strokeThickness: 1,
            }).setOrigin(1, 1);
            this.objects.push(badge);
        } else {
            // Lock icon
            const lock = scene.add.text(x + ILLUST_PAD + ILLUST_SIZE / 2, y + 35, '🔒', {
                fontSize: '36px',
            }).setOrigin(0.5);
            this.objects.push(lock);

            // Hidden title
            const hiddenTitle = scene.add.text(x + ILLUST_SIZE + 24, y + 20, '???', {
                fontFamily: FONT_FAMILY, fontSize: '22px', color: '#AAAAAA',
                fontStyle: 'bold',
            });
            this.objects.push(hiddenTitle);

            // Distance hint
            const hint = scene.add.text(x + ILLUST_SIZE + 24, y + 55, `${entry.distance}m 도달 시 해금`, {
                fontFamily: FONT_FAMILY, fontSize: '14px', color: '#999999',
            });
            this.objects.push(hint);

            // Progress bar
            const barX = x + ILLUST_SIZE + 24;
            const barY = y + CARD_H - 28;
            const barW = CARD_W - ILLUST_SIZE - 50;
            const barBg = scene.add.graphics();
            barBg.fillStyle(0x444444, 1);
            barBg.fillRoundedRect(barX, barY, barW, 10, 5);
            barBg.fillStyle(0x4CAF50, 1);
            barBg.fillRoundedRect(barX, barY, barW * progress, 10, 5);
            this.objects.push(barBg);

            const pctText = scene.add.text(barX + barW + 8, barY - 2, `${Math.floor(progress * 100)}%`, {
                fontFamily: FONT_FAMILY, fontSize: '12px', color: '#AAAAAA',
            });
            this.objects.push(pctText);
        }
    }

    destroy(): void {
        for (const obj of this.objects) obj.destroy();
        this.objects = [];
    }
}
```

**Step 2: tsc check**

Run: `cd /home/cc2/game01/client && npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add client/src/ui/DiaryCard.ts
git commit -m "feat: DiaryCard 해금/잠금 카드 컴포넌트"
```

---

## Task 4: JourneyDiary Scene

**Files:**
- Create: `client/src/scenes/JourneyDiary.ts`
- Modify: `client/src/utils/Constants.ts` — add `SCENE_JOURNEY_DIARY`
- Modify: `client/src/main.ts` — register Scene

**Step 1: Add SCENE constant**

In `client/src/utils/Constants.ts`, after `SCENE_COMPANION_SELECT`:
```typescript
export const SCENE_JOURNEY_DIARY = 'JourneyDiary';
```

**Step 2: Write JourneyDiary.ts**

```typescript
// client/src/scenes/JourneyDiary.ts
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENE_JOURNEY_DIARY, SCENE_MAIN_MENU, FONT_FAMILY } from '../utils/Constants';
import { DIARY_ENTRIES } from '../utils/DiaryData';
import { DiaryCard } from '../ui/DiaryCard';
import { InventoryManager } from '../services/InventoryManager';
import { createButton, fadeToScene, fadeIn } from '../ui/UIFactory';
import { SoundManager } from '../services/SoundManager';

const CARD_H = 140;
const CARD_GAP = 16;
const HEADER_H = 100;
const CARD_X = 40; // (720 - 640) / 2

export class JourneyDiary extends Phaser.Scene {
    private cards: DiaryCard[] = [];
    private scrollContainer!: Phaser.GameObjects.Container;
    private onPointerDown: ((p: Phaser.Input.Pointer) => void) | null = null;
    private onPointerMove: ((p: Phaser.Input.Pointer) => void) | null = null;
    private onPointerUp: (() => void) | null = null;
    private dragStartY = 0;
    private scrollY = 0;
    private isDragging = false;

    constructor() {
        super(SCENE_JOURNEY_DIARY);
    }

    create(): void {
        fadeIn(this);
        const maxDist = InventoryManager.getInstance().getMaxDistance();

        // Background
        this.cameras.main.setBackgroundColor('#1a1a2e');

        // Scroll container
        this.scrollContainer = this.add.container(0, 0);

        // Header
        const title = this.add.text(GAME_WIDTH / 2, 40, '여정 다이어리', {
            fontFamily: FONT_FAMILY, fontSize: '32px', color: '#FFFFFF',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5);
        this.scrollContainer.add(title);

        const subtitle = this.add.text(GAME_WIDTH / 2, 72, `${DIARY_ENTRIES.filter(e => maxDist >= e.distance).length}/${DIARY_ENTRIES.length} 해금`, {
            fontFamily: FONT_FAMILY, fontSize: '16px', color: '#AAAAAA',
        }).setOrigin(0.5);
        this.scrollContainer.add(subtitle);

        // Cards
        for (let i = 0; i < DIARY_ENTRIES.length; i++) {
            const cardY = HEADER_H + i * (CARD_H + CARD_GAP);
            const card = new DiaryCard(this, DIARY_ENTRIES[i], CARD_X, cardY, maxDist);
            this.cards.push(card);
        }

        // Back button (fixed, not in scroll container)
        createButton(this, {
            x: GAME_WIDTH / 2, y: GAME_HEIGHT - 50,
            label: '돌아가기', color: 0x555555, width: 200, height: 44, fontSize: '20px', radius: 12,
            callback: () => {
                SoundManager.getInstance().playSfx('button');
                fadeToScene(this, SCENE_MAIN_MENU);
            },
        });

        // Touch scroll
        const contentH = HEADER_H + DIARY_ENTRIES.length * (CARD_H + CARD_GAP);
        const maxScroll = Math.max(0, contentH - GAME_HEIGHT + 80);

        this.onPointerDown = (p: Phaser.Input.Pointer) => {
            this.isDragging = true;
            this.dragStartY = p.y + this.scrollY;
        };
        this.onPointerMove = (p: Phaser.Input.Pointer) => {
            if (!this.isDragging) return;
            this.scrollY = Phaser.Math.Clamp(this.dragStartY - p.y, 0, maxScroll);
            this.scrollContainer.y = -this.scrollY;
        };
        this.onPointerUp = () => { this.isDragging = false; };

        this.input.on('pointerdown', this.onPointerDown);
        this.input.on('pointermove', this.onPointerMove);
        this.input.on('pointerup', this.onPointerUp);
    }

    shutdown(): void {
        if (this.onPointerDown) this.input.off('pointerdown', this.onPointerDown);
        if (this.onPointerMove) this.input.off('pointermove', this.onPointerMove);
        if (this.onPointerUp) this.input.off('pointerup', this.onPointerUp);
        for (const card of this.cards) card.destroy();
        this.cards = [];
        this.tweens.killAll();
    }
}
```

**Step 3: Register Scene in main.ts**

In `client/src/main.ts`, add import and add to scene array:
```typescript
import { JourneyDiary } from './scenes/JourneyDiary';
// ... in scene array:
scene: [Boot, Preloader, MainMenu, Game, GameOver, Onsen, SkinSelect, Missions, CompanionSelect, QuestSelect, JourneyDiary],
```

**Step 4: tsc check**

Run: `cd /home/cc2/game01/client && npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add client/src/scenes/JourneyDiary.ts client/src/utils/Constants.ts client/src/main.ts
git commit -m "feat: JourneyDiary Scene — 스크롤 타임라인 + 해금 카드"
```

---

## Task 5: MainMenu integration

**Files:**
- Modify: `client/src/scenes/MainMenu.ts`

**Step 1: Add diary button**

In `client/src/scenes/MainMenu.ts`:
- Add `SCENE_JOURNEY_DIARY` to imports from Constants
- Add a button in the "시스템" section, after the 미션 button:

```typescript
// After the 미션 button (line ~132):
createButton(this, {
    x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.8,
    label: '여정 다이어리', color: 0x6D4C41, width: 280, height: 48, fontSize: '22px', radius: 14,
    callback: () => fadeToScene(this, SCENE_JOURNEY_DIARY),
});
```

**Step 2: tsc + vitest**

Run: `cd /home/cc2/game01/client && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests PASS (including new DiaryData tests)

**Step 3: Commit**

```bash
git add client/src/scenes/MainMenu.ts
git commit -m "feat: MainMenu에 여정 다이어리 버튼 추가"
```

---

## Task 6: Final verification

**Step 1: Full test suite**

Run: `cd /home/cc2/game01/client && npx vitest run`
Expected: 310+ tests PASS (297 existing + 13 new DiaryData)

**Step 2: Production build**

Run: `cd /home/cc2/game01/client && npx vite build --config vite/config.prod.mjs`
Expected: Build success, no errors

**Step 3: Bundle size check**

Run: `gzip -c dist/assets/index-*.js | wc -c | awk '{printf "%.0f KB\n", $1/1024}'`
Expected: ~36KB or less (marginal increase from DiaryData + Scene)

**Step 4: Squash commit (optional)**

If all checks pass, optionally squash Tasks 1-5 into a single feature commit:
```bash
git log --oneline -6  # verify commit range
# Keep as separate commits for traceability
```
