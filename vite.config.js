import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export default defineConfig({
    server: {
        cors: {
            origin: [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /\.ngrok-free\.app$/, /\.ngrok\.app$/],
        },
    },
    resolve: {
        alias: {
            '@': resolve(fileURLToPath(new URL('.', import.meta.url)), 'resources/js'),
        },
    },
    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            refresh: true,
        }),
        react(),
    ],
});
