#!/usr/bin/env node
import { spawn } from "node:child_process";

const [subcommand, ...rest] = process.argv.slice(2);

let cmd = "vite";
let args = [];

if (subcommand === "check") {
	cmd = "tsc";
	args = ["--noEmit", ...rest];
} else if (subcommand === "test") {
	cmd = "vitest";
	args = ["run", ...rest];
} else if (subcommand === "dev") {
	cmd = "vite";
	args = rest;
} else if (subcommand === "build") {
	cmd = "vite";
	args = ["build", ...rest];
} else if (subcommand) {
	cmd = subcommand;
	args = rest;
}

const child = spawn(`pnpm exec ${cmd}`, args, {
	stdio: "inherit",
	shell: true,
});

child.on("exit", (code) => {
	process.exit(code ?? 0);
});
