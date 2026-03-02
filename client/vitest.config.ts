import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/utils/GameLogic.ts', 'src/systems/DifficultyManager.ts', 'src/utils/Constants.ts', 'src/utils/OnsenLogic.ts'],
            reporter: ['text'],
        },
    },
});
