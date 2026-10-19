/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
	server: {
		port: 5173,
		host: "0.0.0.0",
	},
	test: {
		include: ["tests/**/*.test.ts"],
		exclude: [".direnv/**", "node_modules/**"],
	},
});
