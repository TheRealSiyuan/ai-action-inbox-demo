import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    resolve: {
        tsconfigPaths: true,
        alias: { "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./tests/setup.ts"],
        include: ["tests/**/*.test.{ts,tsx}"],
        exclude: [
            "**/node_modules/**",
            "tests/eval-ollama.test.ts",
            "tests/eval-briefing-ollama.test.ts",
            "tests/perf/**/*.live.test.ts",
        ],
    },
});
