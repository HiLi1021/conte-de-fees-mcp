# こんとどぅふぇ MCP サーバー — フリーBGM・フリー効果音をAIから

AIアシスタントから、**こんとどぅふぇ**（Conte de Fées）の**フリーBGM・フリー効果音**を
直接さがして、そのままダウンロードできるようにする **MCPサーバー**です。

「かわいい感じのBGMさがして」「戦闘シーンの曲ダウンロードして」——
そう言うだけで、**無料の音楽素材 173曲**と**効果音 402音**から探して保存します。

すべて **商用利用OK / クレジット表記不要 / コンテンツIDフリー**。
アカウント登録もAPIキーも要りません。

> *An MCP server that lets AI assistants search and download **free, royalty-free BGM,
> music and sound effects** from Conte de Fées. 173 tracks and 402 sound effects.
> Commercial use OK, no credit required, Content-ID free. No account, no API key.*

---

## 導入

Node.js 18以上が必要です。npmへの登録は不要で、GitHubから直接入ります。

### Claude Code

```bash
claude mcp add conte-de-fees -- npx -y github:HiLi1021/conte-de-fees-mcp
```

### Claude デスクトップアプリ / Cursor / Cline / Windsurf

設定ファイルに追記して、アプリを再起動してください。

```json
{
  "mcpServers": {
    "conte-de-fees": {
      "command": "npx",
      "args": ["-y", "github:HiLi1021/conte-de-fees-mcp"]
    }
  }
}
```

設定ファイルの場所：

| クライアント | 場所 |
| --- | --- |
| Claude デスクトップ (Mac) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude デスクトップ (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json`（全体なら `~/.cursor/mcp.json`） |
| Cline / Roo Code | `cline_mcp_settings.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

### VS Code（GitHub Copilot）

VS Code だけ最上位キーが `mcpServers` ではなく **`servers`** です。`.vscode/mcp.json` に：

```json
{
  "servers": {
    "conte-de-fees": {
      "command": "npx",
      "args": ["-y", "github:HiLi1021/conte-de-fees-mcp"]
    }
  }
}
```

---

## 使えるツール

| ツール | できること |
| --- | --- |
| `search_music` | フリーBGMを雰囲気・場面・長さ・キーワードで検索 |
| `download_music` | mp3をダウンロードして保存 |
| `search_sound_effects` | フリー効果音を検索（かわいい系 / 8bit系） |
| `list_music_tags` | 利用できるタグの一覧 |
| `get_license` | 利用条件を取得 |

### 話しかけかたの例

```
かわいい感じのフリーBGMを3つ探して
戦闘シーンで使える曲をダウンロードして
2分以内のほのぼのしたBGMある？
ジャンプの効果音を8bitで探して
この曲、YouTubeの収益化動画で使っても大丈夫？
```

---

## ライセンス

**楽曲・効果音**：商用利用OK、クレジット表記不要、コンテンツIDフリー、加工・ループ自由。
禁止事項は音源そのものの再配布・再販売のみ。
→ https://conte-de-fees.com/how-to-use

**このMCPサーバー（ソフトウェア）**：MIT

---

## 安全性について

このサーバーがすることは3つだけです。

1. 公開カタログ（`tracks.json` / `sfx.json`）を読む
2. こんとどぅふぇのmp3をダウンロードする
3. それを保存する

外部コマンドの実行（`exec` / `spawn`）や、パソコンの中のファイルを読むことは**一切しません**。
保存先は**作業ディレクトリの中に限定**していて、外には書き出せません。
取得先も `conte-de-fees.com` 以外は拒否します。

本体は297行、依存は公式SDK（`@modelcontextprotocol/sdk`）ひとつだけです。
[index.js](./index.js) をそのまま読めます。

---

## こんとどぅふぇについて

2003年から続いている、日本のフリー音楽素材サイトです。
楽曲はすべて作曲者HiLiのオリジナルで、素材サイト間の使い回しはありません。

- サイト: https://conte-de-fees.com
- MCPの案内: https://conte-de-fees.com/mcp
- フリーBGM一覧: https://conte-de-fees.com/tracks
- フリー効果音: https://conte-de-fees.com/se

---

<sub>キーワード: フリーBGM MCP / フリー素材 MCP / 音楽素材 MCP / MCPサーバー 音楽 / AI 音楽素材 /
free bgm mcp / royalty free music mcp / music mcp server / free game assets mcp</sub>
