import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tracks = [
  {
    id: 1, oldId: 312, title: "チップSGB Intro", type: "BGM", duration: 83,
    filePath: "http://127.0.0.1/music_material/normal.mp3",
  },
  {
    id: 2, oldId: 2204, title: "無限大ドリーマー", type: "BGM", duration: 197,
    filePath: "http://127.0.0.1/music_material/collab.mp3",
    licenseNote: {
      partner: "みそか（PANICPUMPKIN）",
      terms: ["両者へ使用報告", "両者のウェブサイトへリンク"],
      selfUrl: "https://conte-de-fees.com/",
      partnerUrl: "https://linktr.ee/misokapan",
    },
  },
];

test("MCP returns track-specific conditions without a conflicting blanket license", async () => {
  const http = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/data/tracks.json") res.end(JSON.stringify(tracks));
    else if (req.url === "/data/tags.json") res.end("[]");
    else { res.statusCode = 404; res.end("{}"); }
  });
  await new Promise((ok) => http.listen(0, "127.0.0.1", ok));
  const site = `http://127.0.0.1:${http.address().port}`;
  const child = spawn(process.execPath, ["index.js"], {
    cwd, env: { ...process.env, CDF_SITE: site }, stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  let buffer = "";
  let serial = 0;
  const pending = new Map();
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    buffer += chunk;
    for (let lineEnd; (lineEnd = buffer.indexOf("\n")) !== -1;) {
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      const entry = pending.get(msg.id);
      if (!entry) continue;
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
      else entry.resolve(msg.result);
    }
  });
  child.on("exit", (code) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error(`MCP exited ${code}: ${stderr}`));
    }
    pending.clear();
  });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out: ${method}; ${stderr}`));
    }, 8000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  const call = async (name, args = {}) => {
    const result = await request("tools/call", { name, arguments: args });
    assert.equal(result.isError, undefined, JSON.stringify(result));
    return JSON.parse(result.content[0].text);
  };

  try {
    const initialized = await request("initialize", {
      protocolVersion: "2025-03-26", capabilities: {},
      clientInfo: { name: "license-test", version: "1" },
    });
    assert.equal(initialized.serverInfo.version, "1.5.1");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

    const tools = (await request("tools/list")).tools;
    assert.ok(tools.find((x) => x.name === "get_license").inputSchema.properties.id);
    assert.match(tools.find((x) => x.name === "search_music").description, /個別条件/);

    const normal = await call("search_music", { query: "チップ" });
    assert.equal(normal.曲.length, 1);
    assert.match(normal.ライセンス, /クレジット表記不要/);

    const collab = await call("search_music", { query: "無限大" });
    assert.equal(collab.曲.length, 1);
    assert.equal(collab.曲[0].licenseNote.合作者, "みそか（PANICPUMPKIN）");
    assert.match(collab.ライセンス, /個別条件/);
    assert.doesNotMatch(collab.ライセンス, /クレジット表記不要/);

    const all = await call("search_music", { limit: 2 });
    assert.equal(all.曲.length, 2);
    assert.match(all.ライセンス, /個別条件/);

    const generalLicense = await call("get_license");
    assert.match(generalLicense.クレジット表記, /通常曲は不要/);
    assert.match(generalLicense.クレジット表記, /個別条件/);

    const standardLicense = await call("get_license", { id: 1 });
    assert.equal(standardLicense.クレジット表記, "不要");
    const specialLicense = await call("get_license", { id: 2 });
    assert.match(specialLicense.クレジット表記, /必要/);
    assert.equal(specialLicense.合作者, "みそか（PANICPUMPKIN）");
    assert.equal(specialLicense.条件.length, 2);
    assert.equal(specialLicense.リンク必須.length, 2);
  } finally {
    child.stdin.end();
    child.kill("SIGTERM");
    await new Promise((ok) => http.close(ok));
  }
});
