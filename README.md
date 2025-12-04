# AIToDoList

A FastAPI + vanilla JS implementation of the Eisenhower matrix board described in `要件定義書.md`.

## Features (v1 mock)

- File based persistence (`app/data/*.json`) for tasks and staff
- Drag & drop between quadrants with instant API updates
- Modal form for creating, editing, and deleting tasks
- Staff roster with avatars under `app/static/avatars`
- JSON API (FastAPI) for `/api/tasks` and `/api/staff`

## Getting started

```powershell
# create virtualenv if needed
python -m venv .venv

# activate (PowerShell)
.\.venv\Scripts\activate

# install deps
pip install -r requirements.txt

# run dev server
uvicorn app.main:app --reload
```

Visit `http://127.0.0.1:8000/` in Chrome. The UI fetches data from the API and saves to the JSON files, so you can tweak tasks/staff there if needed.

## Project layout

- `app/main.py` – FastAPI app + template context
- `app/repository.py` – tiny JSON repository for tasks/staff
- `app/schemas.py` – Pydantic models for validation
- `app/templates/index.html` – board UI markup
- `app/static/style.css` / `app/static/app.js` – styling + UI logic
- `app/data/tasks.json` / `staff.json` – mock data used by the repo
- `要件定義書.md` – Japanese requirements document

## Gemini / Nano Banana Pro での 4 象限アバター自動生成

メンバー追加時に 1 枚の顔写真をアップロードすると、オプションで Gemini / Nano Banana Pro を使って
「重要度 × 緊急度」の 4 象限ごとの表情画像を自動生成できます。

- 第 1 象限（重要かつ緊急）: 怒っている表情
- 第 2 象限（重要だが緊急ではない）: やる気に満ちあふれている表情
- 第 3 象限（緊急だが重要ではない）: 困っている表情
- 第 4 象限（重要でも緊急でもない）: お茶を飲んでリラックスしている様子

### 1. 追加でインストールされるライブラリ

`requirements.txt` に以下が追加されています:

- `httpx` – Gemini / Nano Banana Pro Web API を叩くための HTTP クライアント

### 2. 必要な環境変数

Gemini / Nano Banana Pro による自動生成を有効化するには、以下の環境変数を設定します。

- `GEMINI_API_KEY`
  - 必須。Gemini または Nano Banana Pro の API キーを設定します。
- `GEMINI_API_ENDPOINT`
  - 任意。API ベース URL。未設定の場合は公式 Gemini のエンドポイント  
    `https://generativelanguage.googleapis.com/v1beta` を使用します。
- `GEMINI_IMAGE_MODEL`
  - 任意。画像生成・編集に使うモデル名。未設定の場合は  
    `models/gemini-1.5-flash` を使用します。  
    （Nano Banana Pro を利用する場合は、提供されているモデル名を指定してください）
- `GEMINI_ENABLED`
  - 任意。`"0"`, `"false"`, `"no"` のいずれかを設定すると Gemini 経由の画像生成を無効化します。
  - それ以外、かつ `GEMINI_API_KEY` が設定されている場合は有効とみなします。

PowerShell の例:

```powershell
$env:GEMINI_API_KEY = "YOUR_API_KEY_HERE"
$env:GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta"
$env:GEMINI_IMAGE_MODEL = "models/gemini-1.5-flash"
# オフにしたい場合（Geminiを呼ばずに従来通り1枚だけ使う）
$env:GEMINI_ENABLED = "false"
```

### 3. 挙動の概要

- メンバー追加 (`POST /api/staff`) 時:
  - 画像を 1 枚アップロードすると `app/static/avatars/` に保存されます。
  - `GEMINI_ENABLED` が有効かつ `GEMINI_API_KEY` が設定されている場合、
    `app/gemini_client.py` を通じて 4 種類の表情画像を生成し、それぞれ
    `photo_q1`〜`photo_q4` として保存されます。
  - 生成に失敗した場合や API キー未設定の場合は、元の 1 枚のみを使い続けます。
- メンバー更新 (`PUT /api/staff/{id}`) 時:
  - 新しい画像をアップロードした場合のみ、既存の画像ファイルを削除し、
    再度 4 象限用の画像を生成します（同様に、失敗時は元画像のみ）。

フロントエンド側では、タスクカードやメンバー一覧で象限に応じた
アバター画像（`photo_q1`〜`photo_q4`）が自動的に切り替わって表示されます。
