# AIToDoList

Python（FastAPI）で動くアイゼンハワーマトリクス TODO ボードのモックです。  
ひとまずダミーデータを表示するだけですが、ブラウザから UI の雰囲気を確認できます。

## 使い方

1. 依存ライブラリをインストール
   ```powershell
   pip install -r requirements.txt
   ```
2. 開発サーバーを起動
   ```powershell
   uvicorn app.main:app --reload
   ```
3. ブラウザで `http://127.0.0.1:8000/` を開くと 4 象限ボードが表示されます。

## ディレクトリ

- `app/main.py` : FastAPI アプリ本体（モックデータとエンドポイント定義）
- `app/templates/index.html` : ボード画面のテンプレート
- `app/static/style.css` : ボードのスタイル定義
- `要件定義書.md` : 将来実装したい正式版の要件
