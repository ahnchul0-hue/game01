/**
 * SeasonManager — 시즌 이벤트 시스템
 *
 * 현재 날짜를 기반으로 계절/이벤트를 판단하고
 * 색상 테마 및 배너 텍스트를 반환한다.
 *
 * 모든 함수는 Date를 파라미터로 받는 순수 함수로 구현되어
 * 테스트에서 임의의 날짜를 주입할 수 있다.
 */

// 계절 타입
type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// 특별 이벤트 타입
type SpecialEvent = 'christmas' | 'newyear' | 'cherry_blossom' | null;

// 시즌별 색상 테마
export interface SeasonTheme {
    sky: number;       // 하늘색 (Phaser 16진수 색상)
    trees: number;     // 나무색
    ground: number;    // 배경/지면색
    accent: number;    // 강조색 (UI 포인트)
    bgCss: string;     // CSS 배경색 (Phaser Camera.setBackgroundColor용 문자열)
}

// 이벤트 배너 정보
export interface EventBanner {
    text: string;
    bgColor: number;   // 배너 배경색
    textColor: string; // 텍스트 CSS 색상
}

/**
 * 현재 계절을 반환한다.
 * @param date - 기준 날짜 (기본값: 현재 시각)
 *
 * 계절 구분:
 *   spring : 3~5월
 *   summer : 6~8월
 *   autumn : 9~11월
 *   winter : 12~2월
 */
export function getCurrentSeason(date: Date = new Date()): Season {
    const month = date.getMonth() + 1; // getMonth()는 0-indexed

    if (month >= 3 && month <= 5)  return 'spring';
    if (month >= 6 && month <= 8)  return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter'; // 12, 1, 2월
}

/**
 * 시즌별 색상 테마를 반환한다.
 * @param date - 기준 날짜 (기본값: 현재 시각)
 */
export function getSeasonTheme(date: Date = new Date()): SeasonTheme {
    const season = getCurrentSeason(date);

    const themes: Record<Season, SeasonTheme> = {
        spring: {
            sky:    0xFFD6E8, // 연분홍 하늘 (벚꽃 시즌)
            trees:  0x88C057, // 연두 잎
            ground: 0xA8D5A2, // 초록빛 땅
            accent: 0xFF9EB5, // 벚꽃 핑크
            bgCss:  '#FFD6E8',
        },
        summer: {
            sky:    0x4FC3F7, // 선명한 파란 하늘
            trees:  0x2E7D32, // 짙은 초록 나무
            ground: 0x8BC34A, // 생생한 잔디
            accent: 0xFFEB3B, // 태양 노랑
            bgCss:  '#4FC3F7',
        },
        autumn: {
            sky:    0xFFCB87, // 따뜻한 황금빛 하늘
            trees:  0xD2691E, // 단풍 갈색
            ground: 0xC49A6C, // 건조한 땅
            accent: 0xFF6F00, // 단풍 주황
            bgCss:  '#FFCB87',
        },
        winter: {
            sky:    0xB0C4DE, // 차가운 회청빛 하늘
            trees:  0x546E7A, // 앙상한 가지
            ground: 0xECEFF1, // 눈 덮인 땅
            accent: 0x90CAF9, // 차가운 파랑
            bgCss:  '#B0C4DE',
        },
    };

    return themes[season];
}

/**
 * 특별 이벤트 여부를 확인한다.
 * @param date - 기준 날짜 (기본값: 현재 시각)
 *
 * 이벤트 기간:
 *   christmas    : 12/20 ~ 12/31
 *   newyear      : 1/1  ~ 1/7
 *   cherry_blossom: 3/20 ~ 4/10
 */
export function isSpecialEvent(date: Date = new Date()): boolean {
    return getSpecialEvent(date) !== null;
}

/**
 * 현재 특별 이벤트 타입을 반환한다. 이벤트 없으면 null 반환.
 * @param date - 기준 날짜 (기본값: 현재 시각)
 */
export function getSpecialEvent(date: Date = new Date()): SpecialEvent {
    const month = date.getMonth() + 1;
    const day   = date.getDate();

    // 크리스마스: 12월 20일 ~ 12월 31일
    if (month === 12 && day >= 20) return 'christmas';

    // 새해: 1월 1일 ~ 1월 7일
    if (month === 1 && day <= 7) return 'newyear';

    // 벚꽃: 3월 20일 ~ 4월 10일
    if ((month === 3 && day >= 20) || (month === 4 && day <= 10)) return 'cherry_blossom';

    return null;
}

/**
 * 이벤트 배너 텍스트와 스타일을 반환한다.
 * 이벤트가 없으면 null 반환.
 * @param date - 기준 날짜 (기본값: 현재 시각)
 */
export function getEventBanner(date: Date = new Date()): EventBanner | null {
    const event = getSpecialEvent(date);

    if (event === null) return null;

    const banners: Record<Exclude<SpecialEvent, null>, EventBanner> = {
        christmas: {
            text:      'Merry Christmas!',
            bgColor:   0xCC0000,
            textColor: '#FFFFFF',
        },
        newyear: {
            text:      'Happy New Year!',
            bgColor:   0xFFD700,
            textColor: '#3B2000',
        },
        cherry_blossom: {
            text:      'Cherry Blossom Season',
            bgColor:   0xFF9EB5,
            textColor: '#5D1A35',
        },
    };

    return banners[event];
}

