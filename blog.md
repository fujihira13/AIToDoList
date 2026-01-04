---
title: "表情で“忙しさ”が伝わるタスクボードを作った（Eisenhower Board / FastAPI + Vanilla JS + Gemini）"
emoji: "🗂️"
type: "tech"
topics: ["python", "fastapi", "javascript", "hackathon", "gemini"]
published: false
---

# 概要

アイゼンハワーマトリクス（重要度×緊急度の4象限）でタスクを整理できるボード **Eisenhower Board** を作りました。

特徴は、**タスクの象限に応じて担当者アバターの表情が切り替わる**ことです。  
さらに、メンバー登録時に顔写真を1枚アップロードすると、**Geminiで4種類の表情画像を自動生成**できます（失敗時はフォールバックしてアプリは動き続けます）。

実際に作成したコードはこちら（※URLは適宜差し替え）：
https://github.com/[your-repository]/eisenhower-board

---

## できること（ざっくり）

- 4象限ボードでタスクを一覧化（重要度×緊急度）
- タスクカードをドラッグ＆ドロップで象限移動（即時反映）
- 象限に応じて、担当者アバター（`photo_q1`〜`photo_q4`）が自動で切り替わる
- （任意）顔写真1枚から、4象限向けの表情画像をGeminiで自動生成

---

## アイゼンハワーマトリクスとは？

タスクを「重要度」と「緊急度」の2軸で整理するフレームワークです。

| | 急ぎ | 急ぎじゃない |
|---|---|---|
| **大事** | 第1象限：今すぐ対応 | 第2象限：計画的に進める |
| **大事じゃない** | 第3象限：任せる/仕組み化 | 第4象限：手放す/休む |

仕事では特に、**第2象限（重要だが緊急ではない）**が後回しになって炎上しがちなので、ここを可視化して守りたい、というのが出発点でした。

---

## システムの全体構成

```text
ブラウザ（Vanilla JS）
  ↓ Fetch API
FastAPI（app/main.py）
  ↓ JSONファイルに保存/読み込み
app/data/tasks.json, app/data/staff.json
```

Geminiによる表情生成を有効にした場合は、メンバー登録時に下記が追加で動きます。

```text
ブラウザ（顔写真アップロード）
  ↓ POST /api/staff
FastAPI
  ├─ 元画像を保存（app/static/avatars/）
  └─ （条件が揃っていれば）Geminiで4表情生成
        ↓ 生成画像を保存（photo_q1〜photo_q4）
        ↓ staff.json にファイル名を保存
```

### ファイル構成（主要部分）

```
app/
├── main.py                 # FastAPI（API + 画面）
├── repository.py           # JSON永続化
├── schemas.py              # Pydanticモデル
├── gemini_client.py        # 表情画像生成クライアント
├── templates/
│   └── index.html          # UI（ボード）
└── static/
    ├── app.js              # UIロジック
    ├── events.js           # D&Dイベントなど
    ├── api.js              # API呼び出し
    └── avatars/            # アバター画像の保存先
```

---

## UI実装のポイント（ドラッグ＆ドロップ）

タスクカードの移動は、HTML5のDrag & Drop APIを使っています。

- カードをドラッグ → 象限にドロップ
- UIはすぐに更新（体感を軽くする）
- 裏で `PATCH /api/tasks/{id}/quadrant` を叩いて保存

「待ち」を作らずに操作できるので、ハッカソンの短期間でも“触って楽しい”体験に寄せやすかったです。

---

## Geminiで「4象限の表情」を自動生成する

メンバー追加時に、1枚の顔写真から4種類の表情画像を作ります。

- 第1象限（重要かつ緊急）：締切に追われて怒っている/焦っている
- 第2象限（重要だが緊急ではない）：落ち着いてやる気がある
- 第3象限（緊急だが重要ではない）：通知や雑務で困っている
- 第4象限（重要でも緊急でもない）：お茶を飲みながらリラックス

### 有効化条件（フォールバック前提）

- `GEMINI_ENABLED` が無効値でない（`"0"`, `"false"`, `"no"` 以外）
- `GEMINI_API_KEY` が設定されている

どちらかが欠けている/生成に失敗する場合は、**元画像（`photo`）のみで登録を継続**します。

### 環境変数

```text
GEMINI_API_KEY=xxxx
GEMINI_API_ENDPOINT=https://generativelanguage.googleapis.com
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
GEMINI_ENABLED=true
```

### プロンプトの考え方（抜粋）

毎回「同一人物性を保つ」ことを明示しつつ、象限ごとに状況まで具体化しています。

```text
この画像の人物「{staff_name}」をもとに、同じ人物であることが分かるように顔立ちや雰囲気を保ったまま、
表情や状況だけを編集してください。背景はオフィスや仕事中の雰囲気で構いません。

q1: 怒っていて、時間や締め切りに追われているような緊迫した表情
q2: 前向きでやる気に満ちた、落ち着いて計画的に仕事を進めている表情
q3: 電話や通知、雑務に追われて少し困っている表情
q4: デスクでお茶を飲みながらリラックスしている、穏やかな表情
```

---

## セットアップ

### 1. 依存関係のインストール

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Geminiを使う場合（任意）

```powershell
$env:GEMINI_API_KEY = "YOUR_API_KEY"
```

**初心者向けアドバイス**:
まずはGeminiなし（`GEMINI_ENABLED=false`）でUI/CRUDが動くところまで確認して、最後に画像生成を繋ぐのがおすすめです。

---

## 実行方法

```powershell
uvicorn app.main:app --reload
```

起動したら、ブラウザで `http://127.0.0.1:8000/` を開きます。

---

## 生成される成果物（保存されるファイル）

```text
app/data/tasks.json          # タスク
app/data/staff.json          # メンバー（photo/photo_q1〜photo_q4のファイル名を保持）
app/static/avatars/*.png     # 画像（元画像 + 表情画像）
```

---

## 作ってみて学んだこと

### 良かった点

1. **FastAPI + JSON永続化で“とにかく動く”が早い**
2. **Vanilla JSでもD&Dの体験は作れる**
3. **AI機能は「失敗してもアプリが止まらない」設計が大事**

### 苦労した点・工夫した点

1. **同一人物性の維持**
   - 表情だけ変えてほしいのに別人化しがちなので、毎回プロンプトで念押し
2. **外部APIは失敗する前提**
   - エラー時に元画像で続行するフォールバックを入れて、運用のストレスを減らす
3. **人物写真の扱い**
   - 保存場所/共有範囲/削除運用は最初に決めておく（v1はローカル保存）

---

## 今後の改善予定

- スマホ対応（レスポンシブ）
- Slack/Teamsなどへの通知
- チーム全体の負荷可視化（ダッシュボード）
- JSON → SQLite / PostgreSQL（`DB_OPTIONS.md`）

---

## まとめ

アイゼンハワーマトリクスの「優先順位付け」に、表情アバターの“見える化”を足して、チームで使えるタスクボードを作りました。
小さく作って試せる構成（FastAPI + JSON + 任意でGemini）にしておくと、ハッカソンでも拡張でも扱いやすいと感じました。

---

## 参考情報

- FastAPI: https://fastapi.tiangolo.com/
- Gemini API: https://ai.google.dev/
- Eisenhower Matrix（概念）: https://en.wikipedia.org/wiki/Time_management#The_Eisenhower_Method

---

質問や改善案があれば、ぜひコメントください！
