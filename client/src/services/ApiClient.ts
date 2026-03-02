import { API_BASE_URL, LS_KEY_TOKEN, LS_KEY_USER_ID } from '../utils/Constants';

interface UserResponse {
    id: string;
    token: string;
}

export interface ScoreEntry {
    id: string;
    user_id: string;
    score: number;
    distance: number;
    items_collected: number;
    created_at: string;
}

export class ApiClient {
    private baseUrl = API_BASE_URL;

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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
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

    async getTopScores(limit = 10): Promise<ScoreEntry[]> {
        try {
            const res = await fetch(`${this.baseUrl}/api/scores/top?limit=${limit}`);
            if (!res.ok) return [];
            return await res.json();
        } catch {
            return [];
        }
    }
}
