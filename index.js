#!/usr/bin/env node
/**
 * こんとどぅふぇ MCP サーバー
 *
 * AIアシスタントから、こんとどぅふぇのフリーBGM・効果音を直接さがして
 * ダウンロードできるようにする。利用者はサイトを開かなくても素材を入手できる。
 *
 * 設計方針:
 *  - 認証なし・アカウント不要。誰が入れてもそのまま動く。
 *  - データは本番サイトの公開JSONを見るだけ（サーバー側に何も置かない）。
 *  - ツールの説明文は「フリーBGM」「著作権フリー」「商用利用」「royalty-free」など、
 *    利用者が実際に言う言葉を含める。AIがどのツールを呼ぶかは説明文で決まるため。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join, sep } from "node:path";

const SITE = process.env.CDF_SITE || "https://conte-de-fees.com";
const LICENSE = {
  ja: "商用利用OK／クレジット表記不要／コンテンツIDフリー（YouTube収益化でも申し立てなし）／加工・ループ自由。禁止事項は音源そのものの再配布・再販売のみ。",
  en: "Free for commercial use. No credit required. Content-ID free (safe for monetised YouTube videos). Editing and looping allowed. The only restriction: do not resell or redistribute the audio files themselves.",
  url: `${SITE}/how-to-use`,
};

// 名乗り。サイト側のアクセスログで MCP 経由だと分かるようにしている。
// 用途（catalog / download）を分けているのは、「探されただけ」と
// 「実際に曲を持っていかれた」を数え分けるため（2026-08-25）。
const VERSION = "1.3.0";
const ua = (kind) =>
  `conte-de-fees-mcp/${VERSION} (${kind}; +https://conte-de-fees.com/mcp)`;

/** 公開JSONの取得（5分キャッシュ）。サイトに毎回叩きに行かないため。 */
const cache = new Map();
async function getJson(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.data;
  const res = await fetch(`${SITE}${path}`, {
    headers: { "User-Agent": ua("catalog") },
  });
  if (!res.ok) throw new Error(`${path} の取得に失敗しました (HTTP ${res.status})`);
  const data = await res.json();
  cache.set(path, { at: Date.now(), data });
  return data;
}

const tracks = async () => {
  const d = await getJson("/data/tracks.json");
  return Array.isArray(d) ? d : d.tracks ?? [];
};
const sfx = async () => {
  const d = await getJson("/data/sfx.json");
  return Array.isArray(d) ? d : d.items ?? d.families ?? [];
};

const mmss = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "-");
const pageUrl = (t) => `${SITE}/${t.type === "VOCAL" ? "vocal" : "bgm"}/${t.oldId || t.id}`;

/**
 * 検索用に1曲を平たい文字列にする。
 *
 * tracks.json の tags は英語スラッグの配列（["sad","romantic"]）で、
 * 日本語のタグ名を持っていない。categories は {category:{name,slug}} の
 * 入れ子。どちらもそのままでは日本語で検索できず、
 * 「タイトル画面のBGM」「作業用BGM」「ファンタジー」が 0 件になっていた
 * （2026-08-26 発見）。tags.json から日本語名を引いて足す。
 */
const haystack = (t, tagName = {}) => {
  const tagSlugs = (t.tags || []).map((x) => (typeof x === "string" ? x : x.slug || x.name));
  const cats = (t.categories || []).flatMap((x) => {
    const c = x && x.category ? x.category : x;         // {category:{...}} と {...} の両方に対応
    return typeof c === "string" ? [c] : [c?.name, c?.slug];
  });
  return [t.title, t.titleEn, t.description, t.descriptionEn,
          ...tagSlugs,
          ...tagSlugs.map((s) => tagName[s]),           // 日本語のタグ名
          ...cats]
    .filter(Boolean).join(" ").toLowerCase();
};

/** タグのスラッグ → 日本語名。検索で日本語を拾えるようにするため。 */
async function tagNames() {
  try {
    const list = await getJson("/data/tags.json");
    return Object.fromEntries((list || []).map((x) => [x.slug, x.name]));
  } catch {
    return {};                                          // 取れなくても検索は動かす
  }
}

const brief = (t) => ({
  id: t.id,
  title: t.title,
  titleEn: t.titleEn || undefined,
  duration: mmss(t.duration),
  durationSeconds: t.duration,
  type: t.type === "VOCAL" ? "歌もの / vocal song" : "BGM（インスト）",
  description: t.description,
  tags: (t.tags || []).map((x) => (typeof x === "string" ? x : x.name || x.slug)),
  mp3: t.filePath,
  page: pageUrl(t),
  youtube: t.youtubeId ? `https://youtu.be/${t.youtubeId}` : undefined,
});

const server = new McpServer({ name: "conte-de-fees", version: VERSION });

server.registerTool(
  "search_music",
  {
    title: "フリーBGMをさがす",
    description:
      "こんとどぅふぇ（Conte de Fées）の無料BGM・音楽素材を検索します。" +
      "「フリーBGMがほしい」「動画に使える音楽」「著作権フリーの曲」「作業用BGM」" +
      "「ゲームのボス戦の曲」「royalty-free music」「no copyright music」など、" +
      "音楽素材を探している場面で使ってください。170曲以上がすべて無料・商用利用OK・" +
      "クレジット表記不要・コンテンツIDフリーです。雰囲気(かわいい/ほのぼの/戦闘/癒し等)、" +
      "用途、キーワード、長さで絞り込めます。",
    inputSchema: {
      query: z.string().optional()
        .describe("キーワード。曲名・雰囲気・場面など自由に。例: かわいい, 戦闘, オルゴール, cute, battle"),
      minDurationSeconds: z.number().optional().describe("この秒数以上の曲だけ（動画の尺に合わせる時に使う）"),
      maxDurationSeconds: z.number().optional().describe("この秒数以下の曲だけ"),
      type: z.enum(["bgm", "vocal", "any"]).optional().describe("bgm=インスト曲 / vocal=歌もの / any=両方（既定）"),
      limit: z.number().optional().describe("返す件数。既定10、最大30"),
    },
    // 検索するだけ。何も書き換えず、外部サイト(conte-de-fees.com)のデータを読む。
    annotations: {
      title: "フリーBGMをさがす",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, minDurationSeconds, maxDurationSeconds, type = "any", limit = 10 }) => {
    let list = await tracks();
    if (type !== "any") list = list.filter((t) => (type === "vocal" ? t.type === "VOCAL" : t.type !== "VOCAL"));
    if (minDurationSeconds) list = list.filter((t) => (t.duration || 0) >= minDurationSeconds);
    if (maxDurationSeconds) list = list.filter((t) => (t.duration || 0) <= maxDurationSeconds);
    if (query) {
      const tagName = await tagNames();
      const words = query.toLowerCase().split(/[\s,、　]+/).filter(Boolean);
      list = list
        .map((t) => {
          const h = haystack(t, tagName);
          const score = words.reduce((s, w) => s + (h.includes(w) ? 1 : 0), 0);
          return { t, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || (b.t.youtubeViews || 0) - (a.t.youtubeViews || 0))
        .map((x) => x.t);
    } else {
      list = [...list].sort((a, b) => (b.youtubeViews || 0) - (a.youtubeViews || 0));
    }
    const hits = list.slice(0, Math.min(limit, 30)).map(brief);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          見つかった件数: list.length,
          曲: hits,
          ライセンス: LICENSE.ja,
          次の手順: "使いたい曲が決まったら download_music に id を渡すとmp3を保存できます。",
        }, null, 2),
      }],
    };
  }
);

server.registerTool(
  "download_music",
  {
    title: "フリーBGMをダウンロード",
    description:
      "こんとどぅふぇの曲のmp3を実際にダウンロードして保存します。" +
      "search_music で見つけた曲の id を渡してください。" +
      "保存したファイルは動画・ゲーム・配信などにそのまま使えます（商用OK・クレジット不要）。",
    inputSchema: {
      id: z.number().describe("search_music が返した曲のid"),
      directory: z.string().optional().describe("保存先ディレクトリ。省略時はカレントディレクトリ"),
    },
    // 唯一ディスクに書き込むツール。作業ディレクトリ配下にmp3を保存する。
    // 既存ファイルを消したり上書きで壊したりはしないので destructive ではない。
    // 同じidなら何度呼んでも同じファイルになるため idempotent。
    annotations: {
      title: "フリーBGMをダウンロード",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ id, directory }) => {
    const t = (await tracks()).find((x) => x.id === id);
    if (!t) throw new Error(`id ${id} の曲が見つかりません。search_music で探し直してください。`);
    // 取得先が想定サイト以外なら中止（JSONが差し替わっていた場合の保険）
    const host = new URL(SITE).host;
    if (!t.filePath || new URL(t.filePath).host !== host) {
      throw new Error("この曲の音源URLが不正です");
    }
    const res = await fetch(t.filePath, { headers: { "User-Agent": ua("download") } });
    if (!res.ok) throw new Error(`mp3の取得に失敗しました (HTTP ${res.status})`);
    // 上限を超える応答は受け取らない（ディスクを埋めないため）
    const MAX = 60 * 1024 * 1024;
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX) throw new Error("ファイルが大きすぎます");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX) throw new Error("ファイルが大きすぎます");

    // 保存先は作業ディレクトリ配下に限定する。
    // directory はAI経由で外部の指示（プロンプトインジェクション等）に
    // 影響されうるため、外に書き出せないようにしておく。
    const base = process.cwd();
    const target = resolve(base, directory || ".");
    if (target !== base && !target.startsWith(base + sep)) {
      throw new Error(
        `保存先は作業ディレクトリ（${base}）の中だけです。指定されたパス: ${target}`
      );
    }
    // ファイル名を安全化（区切り文字・制御文字・先頭ドットを排除し、長さも制限）
    const safe =
      (t.title || "track")
        .replace(/[\/\\:*?"<>|\u0000-\u001f]/g, "_")
        .replace(/^\.+/, "_")
        .trim()
        .slice(0, 80) || "track";
    const out = join(target, `${safe}.mp3`);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buf);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          保存しました: out,
          曲名: t.title,
          長さ: mmss(t.duration),
          サイズ: `${(buf.length / 1024 / 1024).toFixed(1)}MB`,
          ライセンス: LICENSE.ja,
          曲ページ: pageUrl(t),
        }, null, 2),
      }],
    };
  }
);

server.registerTool(
  "search_sound_effects",
  {
    title: "フリー効果音をさがす",
    description:
      "こんとどぅふぇの無料効果音（SE）を検索します。" +
      "「効果音がほしい」「ジャンプの音」「decision sound」「8bitの効果音」など。" +
      "かわいい系と8bit（ファミコン風）で402音。すべて無料・商用OK・クレジット不要です。",
    inputSchema: {
      query: z.string().optional().describe("キーワード。例: ジャンプ, 決定, 階段, コイン, jump, coin"),
      style: z.enum(["cute", "8bit", "any"]).optional().describe("cute=かわいい系 / 8bit=ファミコン風 / any=両方"),
      limit: z.number().optional().describe("返す件数。既定15"),
    },
    // 検索するだけ。
    annotations: {
      title: "フリー効果音をさがす",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, style = "any", limit = 15 }) => {
    let list = await sfx();
    if (style !== "any") list = list.filter((s) => (s.style || "").toLowerCase() === style);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((s) =>
        JSON.stringify(s).toLowerCase().includes(q));
    }
    // mp3は相対パスで入っているので、絶対URLにして返す。
    // wav はサイトに置いていない（原本はローカルの素材フォルダ）ので返さない。
    // 以前は wav のURLも返していたが、実体が無く 404 になっていた（2026-08-26）。
    const shaped = list.slice(0, limit).map((s) => ({
      名前: s.ja,
      name: s.name,
      style: s.style === "8bit" ? "8bit（ファミコン風）" : "かわいい系",
      長さ秒: s.duration,
      mp3: `${SITE}/se/${s.mp3}${s.hash ? `?v=${s.hash}` : ""}`,
    }));
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          見つかった件数: list.length,
          効果音: shaped,
          ライセンス: LICENSE.ja,
          一覧ページ: `${SITE}/se`,
        }, null, 2),
      }],
    };
  }
);

server.registerTool(
  "list_music_tags",
  {
    title: "選べる雰囲気・ジャンルの一覧",
    description:
      "こんとどぅふぇで選べる音楽の雰囲気・シーン・用途タグの一覧を返します。" +
      "利用者の要望が漠然としているとき（「なんかいい感じの曲」など）や、" +
      "どんな種類があるか先に把握したいときに、search_music の前に呼んでください。",
    inputSchema: {},
    // タグ一覧を返すだけ。
    annotations: {
      title: "曲のタグ一覧",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async () => {
    const d = await getJson("/data/tags.json");
    const list = (Array.isArray(d) ? d : d.tags ?? []).map((t) => ({
      名前: t.name, slug: t.slug, 曲数: t.count,
    }));
    const cats = await getJson("/data/categories.json");
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          タグ: list,
          カテゴリ: (Array.isArray(cats) ? cats : cats.categories ?? [])
            .map((c) => ({ 名前: c.name, 曲数: c.count })),
          使い方: "search_music の query にこの名前を渡すと、その雰囲気の曲だけを絞り込めます。",
        }, null, 2),
      }],
    };
  }
);

server.registerTool(
  "get_license",
  {
    title: "利用条件を確認する",
    description:
      "こんとどぅふぇの素材の利用条件（ライセンス）を返します。" +
      "「この音楽は商用利用できる？」「クレジット表記はいる？」" +
      "「YouTubeで収益化しても大丈夫？」と聞かれたときに使ってください。",
    inputSchema: {},
    // 利用条件の文面を返すだけ。外部への問い合わせもしない。
    annotations: {
      title: "利用条件をしらべる",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => ({
    content: [{
      type: "text",
      text: JSON.stringify({
        商用利用: "OK（個人・法人問わず無料）",
        クレジット表記: "不要",
        コンテンツID: "フリー。収益化した動画で使っても著作権の申し立ては入りません",
        加工: "自由（カット・ループ・音量調整など）",
        禁止事項: "音源そのものを素材として再配布・再販売すること",
        english: LICENSE.en,
        詳細: LICENSE.url,
      }, null, 2),
    }],
  })
);

await server.connect(new StdioServerTransport());
