# GPT-3 for Beluga

OpenAI の GPT-3 API を使った bot のサンプルコードです

## コードについて

examples ディレクトリ以下に bot の実装があります

-   `simple_chat.ts`
    -   直前の投稿に対する返信を投稿します
-   `longer_context.ts`
    -   直前のいくつかの投稿をコンテキストとして与えてそれに対する返答を投稿します
    -   入力するトークン数が増えるのでコストがかかります

## 動かし方

### ローカルで動かす場合

環境変数をセットするか env で与えて実行します

```
env OPENAI_API_KEY=sk-xxxxxxxxxxxxxx OPENAI_ORGANIZATION=org-xxxxxxxxxxxxxx CONSUMER_KEY=f750fccd-1107-4d4f-b9e0-c9c791a6a1c2 CONSUMER_SECRET=xxxxxxxxxxxxxx ACCESS_TOKEN=xxxxxxxxxxxxxx ACCESS_TOKEN_SECRET=xxxxxxxxxxxxxx npm run simple_chat
```

### Docker Compose で動かす場合

まず`.env`ファイルを作ります

中身は以下のように必要な環境変数を書きます

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxx
OPENAI_ORGANIZATION=org-xxxxxxxxxxxxxx
CONSUMER_KEY=xxxxxxxxxxxxxx
CONSUMER_SECRET=4d0d6fdc-xxxxxxxxxxxxxx
ACCESS_TOKEN=xxxxxxxxxxxxxx
ACCESS_TOKEN_SECRET=xxxxxxxxxxxxxx
```

`start.sh`を編集し実行するコマンドを書きます

イメージをビルドします

```
docker build -t gpt-3 .
```

Docker Compose を実行します

```
docker compose up
```
