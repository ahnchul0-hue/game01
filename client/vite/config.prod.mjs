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
                passes: 2
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
                // 로컬 번들: JS/CSS/HTML + 이미지(png/jpg/svg/webp/gif) + 오디오(mp3/ogg/wav) + 폰트(woff2/woff/ttf)
                globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,webp,gif,mp3,ogg,wav,woff2,woff,ttf}'],
                navigateFallback: 'index.html',
                runtimeCaching: [
                    // Google Fonts CSS (스타일시트) — StaleWhileRevalidate: 빠른 응답 + 백그라운드 갱신
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'google-fonts-stylesheets',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    // Google Fonts 실제 폰트 파일 (fonts.gstatic.com) — CacheFirst: 한 번 받으면 로컬 우선
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: {
                                maxEntries: 20,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
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
