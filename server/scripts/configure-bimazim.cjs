#!/usr/bin/env node
/**
 * configure-bimazim.cjs — register (or repair) BIM-AZIM's MCP servers across every
 * MCP-compatible AI client this script knows how to configure: Claude Desktop, Claude Code,
 * Cursor, Windsurf, Gemini CLI, VS Code (+ Insiders), ChatGPT Desktop, OpenCode, and (best-effort,
 * see note below) DeepSeek Harness.
 *
 * Ported from BIM-Bot's revit-mcp-server/scripts/configure-claude.cjs (MIT licensed,
 * https://github.com/HassanElmathary/BIM-Bot) and rebranded. Architectural difference from the
 * original: BIM-Bot registers itself as TWO server keys pointing at the SAME binary with
 * different env vars (BIM-Bot for Revit, BIM-Bot-Navis for Navisworks, scoped via BIMBOT_SCOPE)
 * because its one server only exposes navis_* tools when told to. BIM-AZIM's main server always
 * registers Revit + Navisworks + Tekla tools together (see server/src/index.ts) — no scoping env
 * var needed — so there is only ONE main entry here. The second entry, "BIM-AZIM-Unreal", instead
 * points at the genuinely separate Unreal Engine server (unreal/server/src/index.js), which BIM-Bot
 * also ships as its own standalone server under the same "BIM-Bot-Unreal" naming convention.
 *
 * Improvements over the original during porting (not just a rebrand):
 *  - Gemini CLI is now added, not just removed-on-uninstall — the original script's removeFromProfile
 *    cleans up a Gemini CLI entry that configureProfile never actually wrote; this fixes that gap
 *    (same "mcpServers" JSON schema as Claude Desktop, so the fix is a one-line addition).
 *  - DeepSeek Harness (~/.dsh) support added. DeepSeek Harness is a real desktop MCP-capable agent
 *    runtime (shipped 2026), but its config format is not as publicly documented/stable as the
 *    others here — this is a best-effort writer, flagged clearly in its own function, and must not
 *    be treated with the same confidence as the other (well-documented, battle-tested) clients.
 *
 * Usage:
 *   node configure-bimazim.cjs --node <path-to-node.exe> --server <path-to-main-server-index.js>
 *                              [--home <profile-dir>] [--all-users]
 *   node configure-bimazim.cjs --remove [--home <profile-dir>] [--all-users]
 *
 * --remove deletes the BIM-AZIM entries from every supported MCP client config instead of adding
 * them. Other servers in the same file are always left alone.
 */
const fs = require("fs");
const path = require("path");

const SERVER_KEY = "BIM-AZIM";
const UNREAL_SERVER_KEY = "BIM-AZIM-Unreal";

function parseArgs() {
    const args = process.argv.slice(2);
    const out = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--node") out.node = args[++i];
        else if (args[i] === "--server") out.server = args[++i];
        else if (args[i] === "--home") out.home = args[++i];
        else if (args[i] === "--all-users") out.allUsers = true;
        else if (args[i] === "--remove") out.remove = true;
    }
    return out;
}

function resolvePaths() {
    const opts = parseArgs();
    if (opts.remove) return { nodeExe: null, indexJs: null, unrealIndexJs: null };

    const scriptsDir = __dirname;             // .../server/scripts
    const serverDir = path.dirname(scriptsDir); // .../server
    const repoRoot = path.dirname(serverDir);   // repo root

    let indexJs = opts.server || path.join(serverDir, "build", "index.js");
    if (!fs.existsSync(indexJs)) {
        console.error(`ERROR: BIM-AZIM MCP server not found at ${indexJs}`);
        process.exit(1);
    }

    let nodeExe = opts.node || process.execPath;

    // The Unreal server is a separate, un-built CommonJS project (see unreal/server/package.json
    // — it runs straight from src/, no build step). Only wired up if actually present.
    const unrealIndexJs = path.join(repoRoot, "unreal", "server", "src", "index.js");

    return { nodeExe, indexJs, unrealIndexJs: fs.existsSync(unrealIndexJs) ? unrealIndexJs : null };
}

function isEntryValid(entry) {
    if (!entry || typeof entry !== "object") return false;
    const cmd = entry.command;
    if (!cmd || !path.isAbsolute(cmd) || !fs.existsSync(cmd)) return false;
    const script = Array.isArray(entry.args) ? entry.args[0] : null;
    if (!script || !fs.existsSync(script)) return false;
    return true;
}

/**
 * Ensure BIM-AZIM's entries (main + Unreal, if present) in one JSON config file.
 */
function ensureConfig(label, configPath, nodeExe, indexJs, unrealIndexJs, createIfMissing, opts = {}) {
    const serversKey = opts.serversKey || "mcpServers";
    const stdioType = !!opts.stdioType;

    let config = {};
    let hadBom = false;
    let rebuiltFromBroken = false;
    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, "utf8");
            hadBom = raw.charCodeAt(0) === 0xfeff;
            config = JSON.parse(hadBom ? raw.slice(1) : raw);
        } catch (err) {
            try {
                const stamp = new Date().toISOString().replace(/[:.]/g, "-");
                fs.copyFileSync(configPath, `${configPath}.broken-${stamp}`);
                config = {};
                rebuiltFromBroken = true;
            } catch (copyErr) {
                return `${label}: config is not valid JSON (${err.message}) and could not be backed up (${copyErr.message}) — left untouched: ${configPath}`;
            }
        }
    } else if (!createIfMissing) {
        return `${label}: not installed (no config file) — skipped`;
    }

    if (!config[serversKey] || typeof config[serversKey] !== "object") {
        config[serversKey] = {};
    }

    const specs = [{ key: SERVER_KEY, script: indexJs }];
    if (unrealIndexJs) specs.push({ key: UNREAL_SERVER_KEY, script: unrealIndexJs });

    const allValid = specs.every(({ key }) => isEntryValid(config[serversKey][key]));
    if (allValid && !hadBom) {
        return `${label}: already configured correctly`;
    }

    let wasStale = false;
    for (const { key, script } of specs) {
        if (config[serversKey][key]) wasStale = true;
        const entry = { command: nodeExe, args: [script], env: {} };
        if (stdioType) entry.type = "stdio"; // VS Code requires an explicit transport type.
        config[serversKey][key] = entry;
    }

    try {
        if (fs.existsSync(configPath)) fs.copyFileSync(configPath, configPath + ".bimazim-backup");
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (err) {
        return `${label}: failed to write config (${err.message}): ${configPath}`;
    }

    if (rebuiltFromBroken) return `${label}: config was corrupt (invalid JSON) — backed it up and rebuilt it`;
    if (hadBom) return `${label}: rewrote config without UTF-8 BOM (breaks some parsers)`;
    return `${label}: ${wasStale ? "repaired stale entry" : "added BIM-AZIM entr" + (specs.length > 1 ? "ies" : "y")}`;
}

function removeEntry(label, configPath, opts = {}) {
    const serversKey = opts.serversKey || "mcpServers";
    if (!fs.existsSync(configPath)) return `${label}: no config file — skipped`;
    let config;
    try {
        const raw = fs.readFileSync(configPath, "utf8");
        config = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
    } catch (err) {
        return `${label}: config is not valid JSON (${err.message}) — left untouched: ${configPath}`;
    }
    const servers = config[serversKey];
    if (!servers || typeof servers !== "object" || (!(SERVER_KEY in servers) && !(UNREAL_SERVER_KEY in servers))) {
        return `${label}: no BIM-AZIM entry — skipped`;
    }
    delete servers[SERVER_KEY];
    delete servers[UNREAL_SERVER_KEY];
    try {
        fs.copyFileSync(configPath, configPath + ".bimazim-backup");
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (err) {
        return `${label}: failed to write config (${err.message}): ${configPath}`;
    }
    return `${label}: removed BIM-AZIM entry`;
}

// ── ChatGPT Desktop (TOML, via the Codex config it shares with the Codex CLI) ──────────────

function tomlHeaderParts(line) {
    const m = /^\s*\[\[?(.+?)\]\]?\s*(#.*)?$/.exec(line);
    if (!m) return null;
    const src = m[1];
    const parts = [];
    let i = 0;
    while (i < src.length) {
        while (src[i] === " " || src[i] === "\t") i++;
        let part = "";
        if (src[i] === '"') {
            i++;
            while (i < src.length && src[i] !== '"') {
                if (src[i] === "\\" && i + 1 < src.length) { part += src[i + 1]; i += 2; }
                else part += src[i++];
            }
            i++;
        } else if (src[i] === "'") {
            i++;
            while (i < src.length && src[i] !== "'") part += src[i++];
            i++;
        } else {
            while (i < src.length && /[A-Za-z0-9_-]/.test(src[i])) part += src[i++];
            if (!part) return null;
        }
        parts.push(part);
        while (src[i] === " " || src[i] === "\t") i++;
        if (i < src.length) {
            if (src[i] !== ".") return null;
            i++;
        }
    }
    return parts;
}

function isOwnTomlTable(parts, serverKey) {
    return !!parts && parts.length >= 2 && parts[0] === "mcp_servers" && parts[1] === serverKey;
}

function splitTomlBlock(text, serverKey) {
    const lines = text.split(/\r?\n/);
    const keep = [];
    const own = [];
    let table = [];
    let inOwn = false;
    const inlineKey = new RegExp(`^\\s*(["']?)${serverKey}\\1\\s*=`);
    const rootDotted = new RegExp(`^\\s*mcp_servers\\s*\\.\\s*(["']?)${serverKey}\\1\\s*[.=]`);
    for (const line of lines) {
        const parts = tomlHeaderParts(line);
        if (parts) {
            table = parts;
            inOwn = isOwnTomlTable(parts, serverKey);
        }
        if (inOwn) { own.push(line); continue; }
        if (!parts && table.length === 1 && table[0] === "mcp_servers" && inlineKey.test(line)) { own.push(line); continue; }
        if (!parts && table.length === 0 && rootDotted.test(line)) { own.push(line); continue; }
        keep.push(line);
    }
    return { keep, own };
}

function tomlString(value) {
    if (!/['\r\n]/.test(value)) return `'${value}'`;
    return JSON.stringify(value);
}

function readTomlString(src) {
    if (!src) return null;
    if (src[0] === "'") return src.slice(1, -1);
    try { return JSON.parse(src); } catch { return null; }
}

function isTomlBlockValid(ownLines) {
    const text = ownLines.join("\n");
    const cmd = /^\s*command\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/m.exec(text);
    const arg = /^\s*args\s*=\s*\[\s*("(?:[^"\\]|\\.)*"|'[^']*')/m.exec(text);
    return isEntryValid({ command: readTomlString(cmd && cmd[1]), args: [readTomlString(arg && arg[1])] });
}

function buildTomlBlock(nodeExe, indexJs, serverKey) {
    return [
        `[mcp_servers.${serverKey}]`,
        `command = ${tomlString(nodeExe)}`,
        `args = [${tomlString(indexJs)}]`,
        "startup_timeout_sec = 30",
        "tool_timeout_sec = 300",
    ];
}

function codexHome(home, isCurrentProfile) {
    if (isCurrentProfile && process.env.CODEX_HOME) return process.env.CODEX_HOME;
    return path.join(home, ".codex");
}

function chatGptSeen(home, codexDir) {
    if (fs.existsSync(codexDir)) return true;
    try {
        const packages = path.join(home, "AppData", "Local", "Packages");
        return fs.readdirSync(packages).some((n) => /^OpenAI\.(Codex|ChatGPT)/i.test(n));
    } catch {
        return false;
    }
}

function ensureTomlConfig(label, configPath, nodeExe, indexJs, unrealIndexJs, createIfMissing) {
    let raw = "";
    let hadBom = false;
    if (fs.existsSync(configPath)) {
        try {
            raw = fs.readFileSync(configPath, "utf8");
        } catch (err) {
            return `${label}: failed to read config (${err.message}): ${configPath}`;
        }
        hadBom = raw.charCodeAt(0) === 0xfeff;
        if (hadBom) raw = raw.slice(1);
    } else if (!createIfMissing) {
        return `${label}: not installed (no config file) — skipped`;
    }

    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    const specs = [{ key: SERVER_KEY, script: indexJs }];
    if (unrealIndexJs) specs.push({ key: UNREAL_SERVER_KEY, script: unrealIndexJs });

    let keep = raw;
    let changed = hadBom;
    let addedAny = false;
    for (const { key, script } of specs) {
        const { keep: k, own } = splitTomlBlock(keep, key);
        if (own.length && isTomlBlockValid(own) && !hadBom) continue;
        addedAny = addedAny || !own.length;
        changed = true;
        while (k.length && k[k.length - 1].trim() === "") k.pop();
        keep = (k.length ? k.join(eol) + eol + eol : "") + buildTomlBlock(nodeExe, script, key).join(eol) + eol;
    }
    if (!changed) return `${label}: already configured correctly`;

    try {
        if (fs.existsSync(configPath)) fs.copyFileSync(configPath, configPath + ".bimazim-backup");
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, keep);
    } catch (err) {
        return `${label}: failed to write config (${err.message}): ${configPath}`;
    }
    if (hadBom) return `${label}: rewrote config without UTF-8 BOM (breaks some parsers)`;
    return `${label}: ${addedAny ? "added BIM-AZIM entries" : "repaired stale entry"}`;
}

function removeTomlEntry(label, configPath) {
    if (!fs.existsSync(configPath)) return `${label}: no config file — skipped`;
    let raw;
    try {
        raw = fs.readFileSync(configPath, "utf8");
    } catch (err) {
        return `${label}: failed to read config (${err.message}): ${configPath}`;
    }
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    let keep = raw;
    let found = false;
    for (const key of [SERVER_KEY, UNREAL_SERVER_KEY]) {
        const { keep: k, own } = splitTomlBlock(keep, key);
        if (own.length) found = true;
        keep = k.join(eol);
    }
    if (!found) return `${label}: no BIM-AZIM entry — skipped`;
    keep = keep.split(eol);
    while (keep.length && keep[keep.length - 1].trim() === "") keep.pop();
    try {
        fs.copyFileSync(configPath, configPath + ".bimazim-backup");
        fs.writeFileSync(configPath, keep.length ? keep.join(eol) + eol : "");
    } catch (err) {
        return `${label}: failed to write config (${err.message}): ${configPath}`;
    }
    return `${label}: removed BIM-AZIM entry`;
}

// ── OpenCode (JSON, different schema: command is an array, "environment" not "env") ────────

function openCodeConfigPath(home, isCurrentProfile) {
    if (isCurrentProfile && process.env.OPENCODE_CONFIG) return process.env.OPENCODE_CONFIG;
    const dir = path.join(home, ".config", "opencode");
    const jsonc = path.join(dir, "opencode.jsonc");
    const json = path.join(dir, "opencode.json");
    return !fs.existsSync(json) && fs.existsSync(jsonc) ? jsonc : json;
}

function openCodeSeen(home) {
    return [
        path.join(home, ".config", "opencode"),
        path.join(home, ".local", "share", "opencode"),
        path.join(home, ".opencode"),
        path.join(home, "AppData", "Roaming", "npm", "opencode.cmd"),
    ].some((p) => fs.existsSync(p));
}

function isOpenCodeEntryValid(entry) {
    if (!entry || typeof entry !== "object" || entry.type !== "local") return false;
    const cmd = Array.isArray(entry.command) ? entry.command : [];
    return isEntryValid({ command: cmd[0], args: cmd.slice(1) });
}

function ensureOpenCodeConfig(label, configPath, nodeExe, indexJs, unrealIndexJs, createIfMissing) {
    let config = {};
    let hadBom = false;
    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, "utf8");
            hadBom = raw.charCodeAt(0) === 0xfeff;
            config = JSON.parse(hadBom ? raw.slice(1) : raw);
        } catch (err) {
            return `${label}: config has comments or is not plain JSON (${err.message.split("\n")[0]}) — left untouched: ${configPath}`;
        }
    } else if (!createIfMissing) {
        return `${label}: not installed — skipped`;
    }

    let changed = hadBom;
    let added = false;
    if (!config.$schema) { config.$schema = "https://opencode.ai/config.json"; changed = true; }
    if (!config.mcp || typeof config.mcp !== "object") config.mcp = {};

    const specs = [{ key: SERVER_KEY, script: indexJs }];
    if (unrealIndexJs) specs.push({ key: UNREAL_SERVER_KEY, script: unrealIndexJs });

    for (const { key, script } of specs) {
        const existing = config.mcp[key];
        if (isOpenCodeEntryValid(existing)) continue;
        if (!existing) added = true;
        changed = true;
        config.mcp[key] = {
            type: "local",
            command: [nodeExe, script],
            environment: {},
            enabled: existing && typeof existing.enabled === "boolean" ? existing.enabled : true,
            timeout: 60000,
        };
    }

    if (!changed) return `${label}: already configured correctly`;
    try {
        if (fs.existsSync(configPath)) fs.copyFileSync(configPath, configPath + ".bimazim-backup");
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (err) {
        return `${label}: failed to write config (${err.message}): ${configPath}`;
    }
    if (hadBom) return `${label}: rewrote config without UTF-8 BOM (breaks some parsers)`;
    return `${label}: ${added ? "added BIM-AZIM entries" : "repaired stale entry"}`;
}

function removeOpenCodeEntry(label, configPath) {
    if (!fs.existsSync(configPath)) return `${label}: no config file — skipped`;
    let config;
    try {
        const raw = fs.readFileSync(configPath, "utf8");
        config = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
    } catch (err) {
        return `${label}: config is not plain JSON (${err.message}) — left untouched: ${configPath}`;
    }
    let found = false;
    for (const key of [SERVER_KEY, UNREAL_SERVER_KEY]) {
        if (config.mcp && key in config.mcp) { delete config.mcp[key]; found = true; }
    }
    if (!found) return `${label}: no BIM-AZIM entry — skipped`;
    try {
        fs.copyFileSync(configPath, configPath + ".bimazim-backup");
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (err) {
        return `${label}: failed to write config (${err.message}): ${configPath}`;
    }
    return `${label}: removed BIM-AZIM entry`;
}

// ── DeepSeek Harness (BEST-EFFORT — see module header note) ────────────────────────────────
//
// DeepSeek Harness is a real desktop MCP-capable agent runtime, but as of this writing its
// config format is far less documented/stable than the clients above: public reports describe
// a YAML "patch" file (~/.dsh/profiles/web/cordis.patch.yml), file-only configuration (no GUI),
// and "intermittent failures." This writer makes a reasonable best-effort guess at the format
// (a top-level `mcp_servers:` map, each entry `{command, args}}`) and is NOT held to the same
// confidence as the other, well-documented writers in this file. If it doesn't work, check
// DeepSeek Harness's own current docs for the real schema.

function deepseekHarnessSeen(home) {
    return fs.existsSync(path.join(home, ".dsh"));
}

function deepseekHarnessConfigPath(home) {
    return path.join(home, ".dsh", "profiles", "web", "cordis.patch.yml");
}

function yamlQuote(value) {
    return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function ensureDeepseekHarnessConfig(label, configPath, nodeExe, indexJs, unrealIndexJs, createIfMissing) {
    if (!createIfMissing && !fs.existsSync(configPath)) {
        return `${label}: not installed (no ~/.dsh found) — skipped`;
    }

    let raw = "";
    if (fs.existsSync(configPath)) {
        try { raw = fs.readFileSync(configPath, "utf8"); }
        catch (err) { return `${label}: failed to read config (${err.message}): ${configPath}`; }
    }

    const markerStart = "# --- BIM-AZIM managed block (configure-bimazim.cjs) ---";
    const markerEnd = "# --- end BIM-AZIM managed block ---";
    const startIdx = raw.indexOf(markerStart);
    const endIdx = raw.indexOf(markerEnd);
    const already = startIdx !== -1 && endIdx !== -1 &&
        raw.slice(startIdx, endIdx).includes(indexJs) &&
        (!unrealIndexJs || raw.slice(startIdx, endIdx).includes(unrealIndexJs));
    if (already) return `${label}: already configured correctly (best-effort format, verify in-app)`;

    let withoutBlock = raw;
    if (startIdx !== -1 && endIdx !== -1) {
        withoutBlock = raw.slice(0, startIdx) + raw.slice(endIdx + markerEnd.length);
    }

    const lines = [markerStart, "mcp_servers:"];
    lines.push(`  ${SERVER_KEY}:`, `    command: ${yamlQuote(nodeExe)}`, `    args: [${yamlQuote(indexJs)}]`);
    if (unrealIndexJs) {
        lines.push(`  ${UNREAL_SERVER_KEY}:`, `    command: ${yamlQuote(nodeExe)}`, `    args: [${yamlQuote(unrealIndexJs)}]`);
    }
    lines.push(markerEnd);

    const result = (withoutBlock.trimEnd() ? withoutBlock.trimEnd() + "\n\n" : "") + lines.join("\n") + "\n";

    try {
        if (fs.existsSync(configPath)) fs.copyFileSync(configPath, configPath + ".bimazim-backup");
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, result);
    } catch (err) {
        return `${label}: failed to write config (${err.message}): ${configPath}`;
    }
    return `${label}: added BIM-AZIM entries (BEST-EFFORT format — verify DeepSeek Harness picks them up; its MCP config schema isn't fully stable/documented yet)`;
}

function removeDeepseekHarnessEntry(label, configPath) {
    if (!fs.existsSync(configPath)) return `${label}: no config file — skipped`;
    let raw;
    try { raw = fs.readFileSync(configPath, "utf8"); }
    catch (err) { return `${label}: failed to read config (${err.message}): ${configPath}`; }
    const markerStart = "# --- BIM-AZIM managed block (configure-bimazim.cjs) ---";
    const markerEnd = "# --- end BIM-AZIM managed block ---";
    const startIdx = raw.indexOf(markerStart);
    const endIdx = raw.indexOf(markerEnd);
    if (startIdx === -1 || endIdx === -1) return `${label}: no BIM-AZIM entry — skipped`;
    const result = raw.slice(0, startIdx) + raw.slice(endIdx + markerEnd.length);
    try {
        fs.copyFileSync(configPath, configPath + ".bimazim-backup");
        fs.writeFileSync(configPath, result);
    } catch (err) {
        return `${label}: failed to write config (${err.message}): ${configPath}`;
    }
    return `${label}: removed BIM-AZIM entry`;
}

// ── Orchestration ────────────────────────────────────────────────────────────────────────

function isCurrentHome(home) {
    const current = process.env.USERPROFILE || require("os").homedir();
    return home.toLowerCase() === current.toLowerCase();
}

function configureProfile(home, nodeExe, indexJs, unrealIndexJs, { scanningAllProfiles = false } = {}) {
    const appData = path.join(home, "AppData", "Roaming");
    const localAppData = path.join(home, "AppData", "Local");
    let configured = 0;

    const report = (line) => {
        console.log(`  ${line}`);
        if (!/: (not installed|config is not valid JSON|config has comments|failed to write config)/.test(line)) configured++;
    };

    // Claude Desktop — write even before the app's own folder exists (it reads on first launch).
    const desktopConfig = path.join(appData, "Claude", "claude_desktop_config.json");
    const claudeSeen =
        fs.existsSync(path.join(appData, "Claude")) ||
        fs.existsSync(path.join(localAppData, "AnthropicClaude"));
    report(ensureConfig("Claude Desktop", desktopConfig, nodeExe, indexJs, unrealIndexJs,
        scanningAllProfiles ? claudeSeen : true));

    // Claude Code — only modify ~/.claude.json if it already exists.
    report(ensureConfig("Claude Code", path.join(home, ".claude.json"),
        nodeExe, indexJs, unrealIndexJs, false));

    // Cursor
    const cursorDir = path.join(home, ".cursor");
    report(ensureConfig("Cursor", path.join(cursorDir, "mcp.json"),
        nodeExe, indexJs, unrealIndexJs, fs.existsSync(cursorDir)));

    // Windsurf (Codeium)
    const codeiumDir = path.join(home, ".codeium");
    report(ensureConfig("Windsurf", path.join(codeiumDir, "windsurf", "mcp_config.json"),
        nodeExe, indexJs, unrealIndexJs, fs.existsSync(codeiumDir)));

    // Gemini CLI — same "mcpServers" schema. (BIM-Bot's own script only ever removed this entry
    // on uninstall and never added it — fixed here.)
    const geminiDir = path.join(home, ".gemini");
    report(ensureConfig("Gemini CLI", path.join(geminiDir, "settings.json"),
        nodeExe, indexJs, unrealIndexJs, fs.existsSync(geminiDir)));

    // VS Code / Insiders — top-level "servers" key, each entry needs type "stdio".
    for (const [label, dirName] of [["VS Code", "Code"], ["VS Code Insiders", "Code - Insiders"]]) {
        const codeRoot = path.join(appData, dirName);
        report(ensureConfig(label, path.join(codeRoot, "User", "mcp.json"),
            nodeExe, indexJs, unrealIndexJs, fs.existsSync(codeRoot), { serversKey: "servers", stdioType: true }));
    }

    // ChatGPT Desktop (shares config.toml with the Codex CLI)
    const codexDir = codexHome(home, isCurrentHome(home));
    report(ensureTomlConfig("ChatGPT Desktop", path.join(codexDir, "config.toml"),
        nodeExe, indexJs, unrealIndexJs, chatGptSeen(home, codexDir)));

    // OpenCode
    report(ensureOpenCodeConfig("OpenCode", openCodeConfigPath(home, isCurrentHome(home)),
        nodeExe, indexJs, unrealIndexJs, openCodeSeen(home)));

    // DeepSeek Harness — best-effort, see the function's own doc comment.
    report(ensureDeepseekHarnessConfig("DeepSeek Harness", deepseekHarnessConfigPath(home),
        nodeExe, indexJs, unrealIndexJs, deepseekHarnessSeen(home)));

    return configured;
}

function removeFromProfile(home) {
    const appData = path.join(home, "AppData", "Roaming");
    let removed = 0;
    const report = (line) => {
        console.log(`  ${line}`);
        if (/: removed BIM-AZIM entry/.test(line)) removed++;
    };

    report(removeEntry("Claude Desktop", path.join(appData, "Claude", "claude_desktop_config.json")));
    report(removeEntry("Claude Code", path.join(home, ".claude.json")));
    report(removeEntry("Cursor", path.join(home, ".cursor", "mcp.json")));
    report(removeEntry("Windsurf", path.join(home, ".codeium", "windsurf", "mcp_config.json")));
    report(removeEntry("Gemini CLI", path.join(home, ".gemini", "settings.json")));
    for (const [label, dirName] of [["VS Code", "Code"], ["VS Code Insiders", "Code - Insiders"]]) {
        report(removeEntry(label, path.join(appData, dirName, "User", "mcp.json"), { serversKey: "servers" }));
    }
    report(removeTomlEntry("ChatGPT Desktop", path.join(codexHome(home, isCurrentHome(home)), "config.toml")));
    report(removeOpenCodeEntry("OpenCode", openCodeConfigPath(home, isCurrentHome(home))));
    report(removeDeepseekHarnessEntry("DeepSeek Harness", deepseekHarnessConfigPath(home)));
    return removed;
}

function enumerateUserProfiles() {
    const currentHome = process.env.USERPROFILE || require("os").homedir();
    const usersRoot = path.dirname(currentHome);
    const skip = new Set(["public", "default", "default user", "all users", "defaultapppool", "administrator"]);

    let entries = [];
    try {
        entries = fs.readdirSync(usersRoot, { withFileTypes: true });
    } catch {
        return [currentHome];
    }

    const profiles = entries
        .filter((e) => e.isDirectory() && !skip.has(e.name.toLowerCase()))
        .map((e) => path.join(usersRoot, e.name))
        .filter((p) => fs.existsSync(path.join(p, "AppData", "Roaming")));

    if (!profiles.some((p) => p.toLowerCase() === currentHome.toLowerCase())) {
        profiles.push(currentHome);
    }
    return profiles;
}

function main() {
    const opts = parseArgs();
    if (opts.remove) {
        const profiles = opts.home ? [opts.home] : opts.allUsers ? enumerateUserProfiles() : [process.env.USERPROFILE || require("os").homedir()];
        let totalRemoved = 0;
        for (const home of profiles) {
            console.log(`Profile: ${home}`);
            totalRemoved += removeFromProfile(home);
        }
        console.log(totalRemoved === 0
            ? "\nNo BIM-AZIM entries found — nothing to remove."
            : `\nDone — removed ${totalRemoved} BIM-AZIM entr${totalRemoved === 1 ? "y" : "ies"}.`);
        return;
    }

    const { nodeExe, indexJs, unrealIndexJs } = resolvePaths();
    console.log(`BIM-AZIM MCP setup\n  node:        ${nodeExe}\n  server:      ${indexJs}\n  unreal:      ${unrealIndexJs || "(not found — skipping Unreal entry)"}\n`);

    const profiles = opts.home ? [opts.home] : opts.allUsers ? enumerateUserProfiles() : [process.env.USERPROFILE || require("os").homedir()];

    let totalConfigured = 0;
    for (const home of profiles) {
        console.log(`Profile: ${home}`);
        totalConfigured += configureProfile(home, nodeExe, indexJs, unrealIndexJs, {
            scanningAllProfiles: !!opts.allUsers && !opts.home,
        });
    }

    if (totalConfigured === 0) {
        console.log("\nNo MCP client found to configure. Install Claude Desktop (or another MCP client) and re-run this script.");
    } else {
        console.log(`\nDone — ${totalConfigured} client config(s) in place. ` +
            "Fully quit and reopen your MCP client(s) for changes to take effect.");
    }
}

main();
