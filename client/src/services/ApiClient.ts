import { API_BASE_URL, LS_KEY_TOKEN, LS_KEY_USER_ID, type Inventory } from '../utils/Constants';

interface UserResponse {
    id: string;
    token: string;
}

interface InventoryResponse {
    gem: number;
    mandarin: number;
    watermelon: number;
    hotspring_material: number;
}

interface OnsenLayoutResponse {
    layout_json: string;
}

interface SkinsResponse {
    selected_skin: string;
    unlocked_skins: string;
}

interface CompanionsResponse {
    selected_companion: string;
    unlocked_companions: string;
}

export interface ScoreEntry {
    id?: string;
    user_id: string;
    score: number;
    distance: number;
    items_collected: number;
    created_at: string;
}

export interface Mission {
    id: number;
    mission_type: string;
    target_value: number;
    current_value: number;
    completed: number;
    reward_claimed: number;
    reward_type: string;
    reward_amount: number;
}

export interface StreakInfo {
    current_streak: number;
    longest_streak: number;
    last_play_date: string | null;
    today_reward_claimed: boolean;
}

export interface DailyMissionsResponse {
    missions: Mission[];
    streak: StreakInfo;
}

const API_TIMEOUT_MS = 5000;

let _instance: ApiClient | null = null;

export class ApiClient {
    private baseUrl = API_BASE_URL;
    private isReAuthenticating = false;

    /** 싱글턴 인스턴스 반환 */
    static getInstance(): ApiClient {
        if (!_instance) {
            _instance = new ApiClient();
        }
        return _instance;
    }

    private getToken(): string | null {
        return localStorage.getItem(LS_KEY_TOKEN);
    }

    /** 타임아웃 적용 fetch — 5초 초과 시 AbortError */
    private async fetchWithTimeout(
        url: string,
        options: RequestInit,
        timeoutMs = API_TIMEOUT_MS,
    ): Promise<Response> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(id);
        }
    }

    /** 401 응답 시 토큰 초기화 후 재등록 시도 (재진입 방지) */
    private async handleAuthError(): Promise<void> {
        if (this.isReAuthenticating) return;
        this.isReAuthenticating = true;
        try {
            localStorage.removeItem(LS_KEY_TOKEN);
            localStorage.removeItem(LS_KEY_USER_ID);
            await this.ensureUser();
        } finally {
            this.isReAuthenticating = false;
        }
    }

    async ensureUser(): Promise<void> {
        if (this.getToken()) return;

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await this.fetchWithTimeout(
                    `${this.baseUrl}/api/users`,
                    { method: 'POST' },
                );
                if (!res.ok) break;
                const data: UserResponse = await res.json();
                localStorage.setItem(LS_KEY_TOKEN, data.token);
                localStorage.setItem(LS_KEY_USER_ID, data.id);
                return;
            } catch {
                if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
            }
        }
        // 오프라인 — localStorage 모드로 진행
    }

    async getTopScores(limit = 10): Promise<ScoreEntry[]> {
        try {
            const res = await this.fetchWithTimeout(
                `${this.baseUrl}/api/scores/top?limit=${limit}`,
                {},
            );
            if (!res.ok) return [];
            return await res.json();
        } catch {
            return [];
        }
    }

    async submitScore(score: number, distance: number, itemsCollected: number): Promise<void> {
        return this.authenticatedWrite('POST', '/api/scores', {
            score, distance, items_collected: itemsCollected,
        });
    }

    private authHeaders(): Record<string, string> {
        const token = this.getToken();
        return token
            ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            : { 'Content-Type': 'application/json' };
    }

    // ---- Generic helpers --------------------------------------------------------

    /** Authenticated GET — returns parsed JSON or null on any failure. */
    private async authenticatedGet<T>(endpoint: string): Promise<T | null> {
        const token = this.getToken();
        if (!token) return null;
        try {
            const res = await this.fetchWithTimeout(
                `${this.baseUrl}${endpoint}`,
                { headers: this.authHeaders() },
            );
            if (res.status === 401) { await this.handleAuthError(); return null; }
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }

    /** Authenticated POST/PUT — fire-and-forget with 401 re-auth. */
    private async authenticatedWrite(
        method: 'POST' | 'PUT', endpoint: string, body?: unknown,
    ): Promise<void> {
        const token = this.getToken();
        if (!token) return;
        try {
            const options: RequestInit = { method, headers: this.authHeaders() };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await this.fetchWithTimeout(`${this.baseUrl}${endpoint}`, options);
            if (res.status === 401) await this.handleAuthError();
        } catch {
            // fire-and-forget
        }
    }

    // ---- Inventory --------------------------------------------------------------

    async getInventory(): Promise<InventoryResponse | null> {
        return this.authenticatedGet<InventoryResponse>('/api/inventory');
    }

    async addInventory(items: Partial<Inventory>): Promise<void> {
        return this.authenticatedWrite('PUT', '/api/inventory', {
            add_mandarin: items.mandarin ?? 0,
            add_watermelon: items.watermelon ?? 0,
            add_hotspring_material: items.hotspring_material ?? 0,
        });
    }

    // ---- Onsen ------------------------------------------------------------------

    async getOnsenLayout(): Promise<string | null> {
        const data = await this.authenticatedGet<OnsenLayoutResponse>('/api/onsen/layout');
        return data?.layout_json ?? null;
    }

    async saveOnsenLayout(layoutJson: string): Promise<void> {
        return this.authenticatedWrite('PUT', '/api/onsen/layout', { layout_json: layoutJson });
    }

    // ---- Skins ------------------------------------------------------------------

    async getSkins(): Promise<SkinsResponse | null> {
        return this.authenticatedGet<SkinsResponse>('/api/skins');
    }

    async saveSkins(selectedSkin: string, unlockedSkins: string[]): Promise<void> {
        return this.authenticatedWrite('PUT', '/api/skins', {
            selected_skin: selectedSkin,
            unlocked_skins: JSON.stringify(unlockedSkins),
        });
    }

    // ---- Companions -------------------------------------------------------------

    async getCompanions(): Promise<CompanionsResponse | null> {
        return this.authenticatedGet<CompanionsResponse>('/api/companions');
    }

    async saveCompanions(selectedCompanion: string, unlockedCompanions: string[]): Promise<void> {
        return this.authenticatedWrite('PUT', '/api/companions', {
            selected_companion: selectedCompanion,
            unlocked_companions: unlockedCompanions,
        });
    }

    // ---- Missions ---------------------------------------------------------------

    async getDailyMissions(): Promise<DailyMissionsResponse | null> {
        return this.authenticatedGet<DailyMissionsResponse>('/api/missions/daily');
    }

    async updateMissionProgress(missionType: string, progress: number): Promise<void> {
        return this.authenticatedWrite('POST', '/api/missions/progress', {
            mission_type: missionType, progress,
        });
    }

    async claimMissionReward(missionId: number): Promise<void> {
        return this.authenticatedWrite('POST', `/api/missions/${missionId}/claim`);
    }

    async claimStreakReward(): Promise<void> {
        return this.authenticatedWrite('POST', '/api/missions/streak/claim');
    }
}
