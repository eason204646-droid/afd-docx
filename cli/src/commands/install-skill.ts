import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { CliError } from "../cli-error.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_SRC = path.resolve(__dirname, "..", "..", "skill", "SKILL.md");

const AGENT_DIRS: Record<string, string> = {
  "claude": path.join(osHome(), ".claude", "skills", "afd-docx"),
  "opencode": path.join(osHome(), ".config", "opencode", "skills", "afd-docx"),
};

function osHome(): string {
  return process.env.USERPROFILE || process.env.HOME || ".";
}

function listAgents(): string {
  return Object.keys(AGENT_DIRS).join(", ");
}

export function installSkillCommand(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: afd install-skill [agent]

Install the AFD skill for AI agents.

Agents: ${listAgents()}
If omitted, installs for all supported agents.

Examples:
  afd install-skill            Install for all agents
  afd install-skill claude     Install for Claude Code only
  afd install-skill opencode   Install for opencode only
`);
    return;
  }

  if (!fs.existsSync(SKILL_SRC)) {
    throw new CliError(`Skill file not found at ${SKILL_SRC}. Make sure the package is installed correctly.`);
  }

  const targetAgent = args[0]?.toLowerCase();
  const targets = targetAgent
    ? (AGENT_DIRS[targetAgent] ? [[targetAgent, AGENT_DIRS[targetAgent]]] : [])
    : Object.entries(AGENT_DIRS);

  if (targetAgent && !AGENT_DIRS[targetAgent]) {
    throw new CliError(`Unknown agent: "${targetAgent}". Supported: ${listAgents()}`);
  }

  let installed = 0;
  for (const [name, dir] of targets) {
    const targetFile = path.join(dir, "SKILL.md");
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(SKILL_SRC, targetFile);
    console.log(`Installed AFD skill for ${name} → ${targetFile}`);
    installed++;
  }

  if (installed === 0) {
    throw new CliError("No skill was installed. Specify a supported agent.");
  }
}
