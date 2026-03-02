import { API_BASE_URL, LS_KEY_TOKEN, LS_KEY_USER_ID, type Inventory } from '../utils/Constants';

interface UserResponse {
    id: string;
    token: string;
}

export interface InventoryResponse {
    mandarin: number;
    watermelon: number;
    hotspring_material: number;
}

export interface OnsenLayoutResponse {
    layout_json: string;
}

export interface SkinsResponse {
    selected_skin: string;
    unlocked_skins: string;
}

let _instance: ApiClient | null = null;

export class ApiClient {
    private baseUrl = API_BASE_URL;

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

    async ensureUser(): Promise<void> {
        if (this.getToken()) return;

        try {
            const res = await fetch(`${this.baseUrl}/api/users`, { method: 'POST' });
            if (!res.ok) return;
            const data: UserResponse = await res.json();
            localStorage.setItem(LS_KEY_TOKEN, data.token);
            localStorage.setItem(LS_KEY_USER_ID, data.id);
        } catch {
            // 네트워크 오류 무시
        }
    }

    async submitScore(score: number, distance: number, itemsCollected: number): Promise<void> {
        const token = this.getToken();
        if (!token) return;

        try {
            await fetch(`${this.baseUrl}/api/scores`, {
                method: 'POST',
                headers: this.authHeaders(),
                body: JSON.stringify({
                    score,
                    distance,
                    items_collected: itemsCollected,
                }),
            });
        } catch {
            // fire-and-forget
        }
    }

    private authHeaders(): Record<string, string> {
        const token = this.getToken();
        return token
            ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            : { 'Content-Type': 'application/json' };
    }

    async getInventory(): Promise<InventoryResponse | null> {
        const token = this.getToken();
        if (!token) return null;
        try {
            const res = await fetch(`${this.baseUrl}/api/inventory`, { headers: this.authHeaders() });
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }

    async addInventory(items: Partial<Inventory>): Promise<void> {
        const token = this.getToken();
        if (!token) return;
        try {
            await fetch(`${this.baseUrl}/api/inventory`, {
                method: 'PUT',
                headers: this.authHeaders(),
                body: JSON.stringify({
                    add_mandarin: items.mandarin ?? 0,
                    add_watermelon: items.watermelon ?? 0,
                    add_hotspring_material: items.hotspring_material ?? 0,
                }),
            });
        } catch {
            // fire-and-forget
        }
    }

    async getOnsenLayout(): Promise<string | null> {
        const token = this.getToken();
        if (!token) return null;
        try {
            const res = await fetch(`${this.baseUrl}/api/onsen/layout`, { headers: this.authHeaders() });
            if (!res.ok) return null;
            const data: OnsenLayoutResponse = await res.json();
            return data.layout_json;
        } catch {
            return null;
        }
    }

    async saveOnsenLayout(layoutJson: string): Promise<void> {
        const token = this.getToken();
        if (!token) return;
        try {
            await fetch(`${this.baseUrl}/api/onsen/layout`, {
                method: 'PUT',
                headers: this.authHeaders(),
                body: JSON.stringify({ layout_json: layoutJson }),
            });
        } catch {
            // fire-and-forget
        }
    }

    async getSkins(): Promise<SkinsResponse | null> {
        const token = this.getToken();
        if (!token) return null;
        try {
            const res = await fetch(`${this.baseUrl}/api/skins`, { headers: this.authHeaders() });
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }

    async saveSkins(selectedSkin: string, unlockedSkins: string[]): Promise<void> {
        const token = this.getToken();
        if (!token) return;
        try {
            await fetch(`${this.baseUrl}/api/skins`, {
                method: 'PUT',
                headers: this.authHeaders(),
                body: JSON.stringify({
                    selected_skin: selectedSkin,
                    unlocked_skins: JSON.stringify(unlockedSkins),
                }),
            });
        } catch {
            // fire-and-forget
        }
    }
}
