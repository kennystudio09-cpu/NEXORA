import {spawn} from "node:child_process";
console.log("MOCK AI EVALUATION: real PostgreSQL/Redis, explicitly mocked model and HTTP transport. This is not live OpenAI verification.");
const child=spawn("pnpm",["--filter","@nexora/api","exec","tsx","--test","test/ai.unit.test.ts","test/ai.integration.test.ts"],{stdio:"inherit",env:process.env});child.on("exit",code=>{process.exitCode=code??1;});
