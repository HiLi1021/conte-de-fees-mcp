# こんとどぅふぇ MCP サーバー

AIアシスタントから、**こんとどぅふぇ**（Conte de Fées）のフリーBGM・効果音を
直接さがして、そのままダウンロードできるようにする MCP サーバーです。

すべて **商用利用OK / クレジット表記不要 / コンテンツIDフリー**。
アカウント登録もAPIキーも要りません。

*An MCP server that lets AI assistants search and download free, royalty-free
BGM and sound effects from Conte de Fées. Commercial use OK, no credit required,
Content-ID free. No account or API key needed.*

## 導入

**Claude Code**
```bash
claude mcp add conte-de-fees -- npx -y conte-de-fees-mcp
```

**Claude デスクトップ / その他のMCPクライアント**
```json
{
  "mcpServers": {
    "conte-de-fees": {
      "command": "npx",
      "args": ["-y", "conte-de-fees-mcp"]
    }
  }
}
```

## 使いかた

導入したら、普通に話しかけるだけです。

```
「動画に使えるフリーBGMある？」
「ゲームのボス戦っぽい曲ちょうだい」
「作業用の落ち着いたやつ、3分以上で」
「かわいいジャンプの効果音ほしい」
「この曲、商用利用しても大丈夫？」
```

AIが自動で検索し、mp3を手元に保存し、利用条件も正しく説明します。

## ツール

| ツール | できること |
|---|---|
| `search_music` | 雰囲気・キーワード・長さ・種別でフリーBGMを検索 |
| `download_music` | 選んだ曲のmp3を実際に保存 |
| `search_sound_effects` | フリー効果音（189音）を検索 |
| `list_music_tags` | 選べる雰囲気・シーン・用途の一覧 |
| `get_license` | 利用条件（商用利用・クレジット・収益化）を確認 |

## ライセンス

素材（音源）の利用条件:

- **商用利用OK** — 個人・法人問わず無料
- **クレジット表記不要**
- **コンテンツIDフリー** — 収益化したYouTube動画でも申し立てが入りません
- **加工自由** — カット・ループ・音量調整など
- **禁止事項** — 音源そのものを素材として再配布・再販売すること

詳細: https://conte-de-fees.com/how-to-use

このMCPサーバー自体のコードは MIT ライセンスです。

## 提供元

こんとどぅふぇ（Conte de Fées） — https://conte-de-fees.com
2003年から続く、絵本のような世界観のフリーBGM・音楽素材サイト。
