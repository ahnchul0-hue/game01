/**
 * ErrorTracker — 프로덕션 클라이언트 에러 캡처 + 서버 전송.
 *
 * window.onerror / unhandledrejection을 캡처하여
 * 서버 /api/telemetry 엔드포인트로 배치 전송.
 * 중복 억제 + 전송 제한으로 과부하 방지.
 */

const TELEMETRY_URL = '/api/telemetry';
const MAX_QUEUE = 10;
const FLUSH_INTERVAL = 30_000; // 30초
const MAX_ERRORS_PER_SESSION = 50;

interface ErrorEvent {
    type: 'error' | 'unhandled_rejection';
    message: string;
    source?: string;
    line?: number;
    col?: number;
    stack?: string;
    ts: number;
}

class ErrorTrackerImpl {
    private queue: ErrorEvent[] = [];
    private sentCount = 0;
    private seenMessages = new Set<string>();
    private flushTimer: ReturnType<typeof setInterval> | null = null;
    private installed = false;

    install(): void {
        if (this.installed) return;
        this.installed = true;

        window.onerror = (msg, source, line, col, err) => {
            this.capture({
                type: 'error',
                message: String(msg),
                source: source ?? undefined,
                line: line ?? undefined,
                col: col ?? undefined,
                stack: err?.stack,
                ts: Date.now(),
            });
        };

        window.addEventListener('unhandledrejection', (ev) => {
            const reason = ev.reason;
            const message = reason instanceof Error ? reason.message : String(reason);
            const stack = reason instanceof Error ? reason.stack : undefined;
            this.capture({
                type: 'unhandled_rejection',
                message,
                stack,
                ts: Date.now(),
            });
        });

        this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);

        // 페이지 언로드 시 남은 에러 전송
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.flush();
        });
    }

    private capture(event: ErrorEvent): void {
        if (this.sentCount >= MAX_ERRORS_PER_SESSION) return;

        // 중복 억제: 같은 메시지는 세션당 1회만
        const key = `${event.type}:${event.message}`;
        if (this.seenMessages.has(key)) return;
        this.seenMessages.add(key);

        // stack 길이 제한 (1KB)
        if (event.stack && event.stack.length > 1024) {
            event.stack = event.stack.slice(0, 1024);
        }

        this.queue.push(event);

        if (this.queue.length >= MAX_QUEUE) {
            this.flush();
        }
    }

    private flush(): void {
        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0, MAX_QUEUE);
        this.sentCount += batch.length;

        const body = JSON.stringify({ errors: batch });

        // sendBeacon for reliability on page unload, fetch as fallback
        if (navigator.sendBeacon) {
            navigator.sendBeacon(TELEMETRY_URL, body);
        } else {
            fetch(TELEMETRY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true,
            }).catch(() => {});
        }
    }

    destroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        this.flush();
    }
}

export const ErrorTracker = new ErrorTrackerImpl();
