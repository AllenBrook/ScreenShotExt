---
title: コマンド ラインからウェブサイトのスクリーンショットを撮る
description: OpenScreenShot CLI で、固定ビューポート、ページ全体、stdout へのバイナリ出力で PNG のスクリーンショットを保存します。
audience: developers
order: 4
---

OpenScreenShot CLI は、ローカルにインストールされた Chrome 互換ブラウザを使って、ウェブページを PNG としてキャプチャします。ブラウザ拡張機能とは別のパッケージです。Node.js、pnpm、Chrome がインストールされていれば、次を実行します。

```sh
pnpm dlx openscreenshot shot https://example.com --out screenshot.png --full
```

このコマンドは別のヘッドレス ブラウザを起動し、URL に移動して画像を書き込み、ブラウザを閉じます。普段使っているブラウザのタブやログイン済みのプロファイルには接続しません。

## ビューポートを明示的に設定する

ビューポートのスクリーンショットでは、`--full` を省きます。幅のデフォルトは 1280 ピクセル、高さのデフォルトは 800 ピクセルです。レイアウトに特定のサイズが必要な場合は、両方を設定します。

```sh
pnpm dlx openscreenshot shot https://example.com --out desktop.png --width 1440 --height 900
pnpm dlx openscreenshot shot https://example.com --out narrow.png --width 390 --height 844
```

幅には 200～3840、高さには 200～2160 の整数を指定できます。狭いビューポートでは、その幅でのレスポンシブ レイアウトを確認できます。ただし、スマートフォンのタッチ入力、デバイス ピクセル比、モバイル ブラウザはエミュレートしません。CLI はデスクトップのユーザー エージェントを使います。

ビューポートの外までキャプチャするには、`--full` を追加します。ヘッドレス ブラウザのページ全体のキャプチャは、拡張機能のスクロールしてつなぎ合わせる実装とは異なります。動的なページがどちらでもまったく同じに見えるとは考えないでください。

## ファイルに保存するか stdout に書き出す

`--out` を指定しない場合、コマンドは現在のディレクトリに `screenshot.png` を書き込みます。成果物を見分けやすくするには、ファイル名を明示してください。出力先の親ディレクトリは、コマンドの実行前に作成しておきます。

`--out -` は PNG のバイトを stdout に書き出します。

```sh
pnpm dlx openscreenshot shot https://example.com --out - > screenshot.png
```

バイナリを壊さないリダイレクトを使ってください。CLI は常に PNG を出力します。出力に `capture.jpg` や `capture.pdf` という名前を付けても変換はされません。注釈付きの画像や PDF の出力には、[拡張機能のエディタ](/ja/docs/#export)を使ってください。

## 保存する前に墨消しする

3 つのフラグで、スクリーンショットを撮る前にページ内のデータを黒い四角で覆います。そのため、墨消し前のピクセルが PNG に入ることはありません。対象を増やすには、各フラグを繰り返します。

```sh
pnpm dlx openscreenshot shot https://example.com --out safe.png \
  --redact "#account-menu" --redact-pattern email,secret --redact-rect 0,0,200,40
```

`--redact` は、CSS セレクターに一致する各要素を、そのすべての子要素とともに覆います。`--redact-pattern` は、`email`、`phone` (9～15 桁の数字)、`secret` (一般的な API キーやトークンの形式、長いハッシュ) に一致するテキストとフォームの値を覆います。`--redact-rect x,y,w,h` は、出力画像のピクセル単位で指定した四角形を覆います。キャンバス、画像、クロスオリジンの iframe にはこれを使ってください。

セレクターに一致する要素がない場合、四角形が画像の外にある場合、またはキャプチャ中にページが対象を動かした場合、キャプチャは終了コード 1 で失敗し、ファイルを書き込みません。パターンは、複数の要素に分かれたテキストや、画像として描かれたテキストを見逃すことがあります。共有する前に PNG を確認してください。

## よくある失敗を解決する

Chrome が見つからない場合は、インストールするか、`CHROME_PATH` にブラウザの実行ファイルを設定します。たとえば、Chromium が次のパスにインストールされている Linux システムでは、次のようにします。

```sh
CHROME_PATH=/usr/bin/chromium pnpm dlx openscreenshot shot https://example.com --out screenshot.png
```

ページ移動は `networkidle2` を待ち、タイムアウトは 30 秒です。現在のコマンドには、独自の待機、セレクターの待機、Cookie、ログインのオプションはありません。また、キャプチャが成功しても、アプリケーションが正しく読み込まれたことの証明にはなりません。PNG を開いて、エラー ページ、読み込み中の状態、欠けているアセットがないか確認してください。

終了コード 0 はキャプチャ コマンドが完了したこと、1 はキャプチャの失敗、2 は使い方の誤りまたは引数の検証エラーを示します。コマンドをつなげるときはこれらのコードを使い、そのうえで画像そのものを確認してください。

繰り返し再現できる成果物については、[CI でのキャプチャ ガイド](/ja/blog/screenshots-for-ci/)をご覧ください。エージェントを使う手順については、[MCP のセットアップ ガイド](/ja/blog/screenshot-mcp-server/)をご覧ください。使えるフラグは [CLI のソース](https://github.com/pghqdev/OpenScreenShot/tree/main/mcp/src)を参照してください。
