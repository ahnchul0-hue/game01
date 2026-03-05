import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);

            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}

export default defineConfig({
    base: './',
    logLevel: 'warning',
    build: {
        target: 'es2020',
        chunkSizeWarningLimit: 4000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/phaser')) {
                        return 'phaser';
                    }
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2,
                drop_console: true,
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    },
    server: {
        port: 8080
    },
    plugins: [
        phasermsg(),
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                // 로컬 번들: JS/CSS/HTML + 이미지(png/jpg/svg/webp/gif) + 폰트(woff2/woff/ttf)
                // 오디오는 runtimeCaching에서 lazy 캐싱 (초기 SW 설치 경량화)
                globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,webp,gif,woff2,woff,ttf}'],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB — Phaser 청크 precache 보장
                navigateFallback: 'index.html',
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                    // 오디오 파일 — CacheFirst + rangeRequests (Safari 호환)
                    {
                        urlPattern: /\.(?:mp3|ogg|wav)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'audio-cache',
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 * 60 * 24 * 60, // 60일
                            },
                            rangeRequests: true,
                            cacheableResponse: {
                                statuses: [0, 200, 206],
                            },
                        },
                    },
                    // API 요청은 항상 네트워크 (캐싱 금지)
                    {
                        urlPattern: /\/api\//,
                        handler: 'NetworkOnly',
                    },
                ],
            },
            manifest: false, // use existing public/manifest.json
        }),
    ]
});
