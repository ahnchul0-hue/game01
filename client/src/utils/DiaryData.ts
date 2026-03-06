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

export function getUnlockedCount(maxDistance: number): number {
    return DIARY_ENTRIES.filter(e => maxDistance >= e.distance).length;
}

export function getEntryProgress(entry: DiaryEntry, maxDistance: number): number {
    if (entry.distance === 0) return 1;
    return Math.min(1, maxDistance / entry.distance);
}
