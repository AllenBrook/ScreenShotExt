---
title: AI エージェント向けにローカルのスクリーンショット MCP サーバーを設定する
description: OpenScreenShot を stdio の MCP クライアントに接続し、URL、ビューポート、ページ全体のオプションを指定して PNG を取得します。
audience: developers
order: 5
published: 2026-09-18
updated: 2026-10-21
---

OpenScreenShot には、ツールを 1 つ持つローカル MCP サーバー `capture_screenshot` があります。MCP クライアントはウェブページの URL を指定してこのツールを呼び出し、PNG の画像コンテンツを受け取れます。デフォルトでは、サーバーは手元のマシンで別のヘッドレス Chrome 互換ブラウザを起動します。ブラウザ拡張機能は不要です。

## MCP クライアントにサーバーを追加する

まず、Node.js、pnpm、Chrome 互換ブラウザをインストールします。クライアントの設定形式に合わせて、サーバーのエントリを追加します。`mcpServers` オブジェクトを受け付けるクライアントでは、次のように書けます。

```json
{
  "mcpServers": {
    "openscreenshot": {
      "command": "pnpm",
      "args": ["dlx", "openscreenshot"]
    }
  }
}
```

クライアントは、実行パス上で `pnpm` を見つけられる必要があります。設定を保存したら、クライアントを再起動するか MCP 接続を再読み込みします。サーバーは stdio を使うため、クライアントがローカルのプロセスを起動します。入力する URL はありません。リモートの MCP URL しか受け付けないクライアント向けに、OpenScreenShot Cloud がリモート エンドポイントを提供しています (後述)。

Chrome が通常とは異なる場所にインストールされている場合は、クライアントの環境変数の設定で `CHROME_PATH` を渡します。アプリケーションを含むフォルダーではなく、実行ファイルのフル パスを指定してください。

## capture_screenshot を呼び出す

最小のツール入力は次のとおりです。

```json
{ "url": "https://example.com" }
```

これは、デフォルトの 1280 × 800 のサイズでビューポートをキャプチャします。再現できるリクエストにするには、ビューポートとページ全体のオプションを明示的に設定します。

```json
{
  "url": "https://example.com",
  "fullPage": true,
  "width": 1440,
  "height": 900
}
```

`width` には 200～3840、`height` には 200～2160 の整数を指定できます。ツールは MIME タイプ `image/png` の MCP 画像コンテンツを返します。このツールには出力パスの引数はありません。結果を表示するか保存するかはクライアントによって異なります。名前付きのファイルを直接得たい場合は、[CLI](/ja/blog/screenshot-cli/) を使ってください。

## 画像がツールを離れる前にデータを墨消しする

`redact` オブジェクトを追加すると、スクリーンショットを撮る前にページ内のデータを黒い四角で覆います。クライアントが受け取るのは、墨消しした画像だけです。

```json
{
  "url": "https://example.com",
  "redact": {
    "selectors": ["#account-menu"],
    "patterns": ["email", "phone", "secret"],
    "rects": [{ "x": 0, "y": 0, "width": 200, "height": 40 }]
  }
}
```

`selectors` は、一致する各要素を、そのすべての子要素とともに覆います。`patterns` は、一致するテキストとフォームの値を覆います。対象は `email`、`phone` (9～15 桁の数字)、`secret` (一般的な API キーやトークンの形式、長いハッシュ) です。`rects` は、出力画像のピクセル単位で指定した四角形を覆います。キャンバス、画像、クロスオリジンの iframe に使います。セレクターに一致する要素がない場合、四角形が画像の外にある場合、またはキャプチャ中にページが対象を動かした場合、ツールはエラーを返し、画像は返しません。パターンは、複数の要素に分かれたテキストや、画像として描かれたテキストを見逃すことがあります。

## OpenScreenShot Cloud でレンダリングする

`cloud: true` を付けると、ローカルの Chrome ではなく、オプションのホスト型スクリーンショット API である [OpenScreenShot Cloud](https://cloud.openscreenshot.app) でページをレンダリングします。

```json
{ "url": "https://example.com", "fullPage": true, "cloud": true }
```

Cloud モードには API キーが必要です。`pnpm dlx openscreenshot auth login` を一度実行してキーを保存するか、クライアントのサーバー設定で環境変数 `OPENSCREENSHOT_API_KEY` を設定してください。`redact` はどちらのモードでも使えます。Cloud モードでは、Cloud のサーバーが画像を返す前に黒い四角を描きます。

Cloud は、Streamable HTTP のリモート MCP エンドポイントも `https://cloud.openscreenshot.app/mcp` で提供しています。ツールは同じ `capture_screenshot` です。API キーは `Authorization: Bearer <key>` ヘッダーで送ります。リモートの MCP URL しか受け付けないクライアントでは、こちらを使ってください。無料プランでは、カード登録なしで月 100 回までキャプチャできます。そのほかのプランは[料金ページ](https://cloud.openscreenshot.app/pricing)をご覧ください。

## エージェントに見えるものと見えないもの

キャプチャは新しいヘッドレス ブラウザで始まります。普段使っている Chrome ウィンドウの Cookie やログイン済みのセッションは引き継ぎません。そのため、認証が必要なページではログイン画面が表示されることがあります。現在のツールには、ログイン手順、Cookie の注入、セレクターの待機、操作のためのクリックはありません。

結論を出す前に、返された画像に実際に何が見えているかをエージェントに確認させてください。スクリーンショットは、レイアウト、余白、目に見えるエラーの確認には役立ちます。しかし、フォームが正しく送信されることや、キーボード操作が機能することは証明できません。

## スクリーンショットはどこに送られるか

デフォルトでは、スクリーンショットはローカルで生成され、MCP クライアントに返されます。そのクライアントがホスト型のモデルを使っている場合、クライアント自身の設定に従って、返された画像をモデルの提供元に送信することがあります。キャプチャがローカルであっても、エージェントとの会話全体がデバイス上に留まるとは限りません。提供元に届いてはならないデータには、`redact` を使ってください。`cloud: true` の場合は、URL とオプションが OpenScreenShot Cloud に送られ、ページは Cloud のサーバーでレンダリングされます。詳しくは [Cloud のプライバシー ポリシー](https://cloud.openscreenshot.app/privacy)をご覧ください。

サイズが予測できる自動キャプチャについては、[CI 向けのスクリーンショット](/ja/blog/screenshots-for-ci/)をご覧ください。[エージェント用のキャプチャ スキル](/skills/capture-screenshot.md)と[サーバーのソース](https://github.com/pghqdev/OpenScreenShot/blob/main/mcp/src/serve.ts)に、機械向けの手順とツールの定義があります。このサーバーは [Glama](https://glama.ai/mcp/servers/PGHQdev/OpenScreenShot) にも掲載されています。
