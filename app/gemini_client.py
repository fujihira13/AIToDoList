"""
Gemini / Nano Banana Pro 用の画像生成クライアントモジュール。

ポイント:
- このファイルでは「1枚の元画像 + テキストプロンプト」から
  「編集後の1枚の画像」を返す関数を定義します。
- 実装は **公式のGemini Web API** を前提にしていますが、
  Nano Banana Pro のAPI仕様に合わせて
  `GEMINI_API_ENDPOINT` などを差し替えれば流用できる構成にしています。

初心者向けメモ:
- 「環境変数」は、パソコンやサーバーの設定として
  プログラムの外側にしまっておく秘密情報の入れ物だと思ってください。
  APIキーはコードに直書きせず、環境変数から読み込みます。
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict

import httpx


class GeminiConfigError(RuntimeError):
    """Gemini / Nano Banana Pro の設定が不足しているときに送出するエラー。"""


class GeminiAPIError(RuntimeError):
    """Gemini / Nano Banana Pro 呼び出し時のエラー。"""


@dataclass
class GeminiSettings:
    """
    Gemini / Nano Banana Pro 接続に必要な設定値をまとめたクラス。

    - api_key:   Gemini あるいは Nano Banana Pro のAPIキー
    - endpoint:  ベースURL
                 例）公式Geminiの場合:
                     https://generativelanguage.googleapis.com/v1beta
    - model:     利用するモデル名
                 例）\"models/gemini-1.5-flash\" や
                     \"models/gemini-3.0-nano-banana-pro\" など
    """

    api_key: str
    endpoint: str
    model: str

    @classmethod
    def from_env(cls) -> "GeminiSettings":
        """
        環境変数から設定を読み込みます。

        - GEMINI_API_KEY        : 必須（ここにAPIキーを設定）
        - GEMINI_API_ENDPOINT   : 任意（未設定なら公式GeminiのURLを使用）
        - GEMINI_IMAGE_MODEL    : 任意（未設定なら汎用的なモデル名を使用）

        ※ Nano Banana Pro を使う場合
          - GEMINI_API_ENDPOINT に Nano Banana Pro のAPIベースURL
          - GEMINI_IMAGE_MODEL  に Nano Banana Pro で指定するモデル名
          を設定してください。
        """

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise GeminiConfigError(
                "GEMINI_API_KEY が設定されていません。環境変数にAPIキーを設定してください。"
            )

        endpoint = os.getenv(
            "GEMINI_API_ENDPOINT",
            "https://generativelanguage.googleapis.com/v1beta",
        )
        model = os.getenv("GEMINI_IMAGE_MODEL", "models/gemini-1.5-flash")
        return cls(api_key=api_key, endpoint=endpoint, model=model)


async def _generate_single_image(
    image_path: Path,
    prompt: str,
    settings: GeminiSettings,
) -> bytes:
    """
    1枚の入力画像 + テキストプロンプトから、1枚の画像を生成してバイナリを返します。

    実装イメージ:
    - 入力画像を読み込んで base64 文字列に変換
    - Gemini / Nano Banana Pro の `generateContent` などのエンドポイントを呼び出す
    - レスポンスの `inlineData` から生成された画像の base64 データを取り出し、元のバイナリに戻す

    注意:
    - 実際のレスポンス形式は利用するモデルやAPI仕様により多少異なる可能性があります。
      必要に応じて公式ドキュメントに合わせてフィールド名を調整してください。
    """

    if not image_path.exists():
        raise GeminiAPIError(f"入力画像が見つかりません: {image_path}")

    # 画像ファイルをバイナリとして読み込む
    image_bytes = image_path.read_bytes()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    # 公式Geminiの generateContent を想定したペイロード構造
    # Nano Banana Pro を使う場合も、基本的には
    # 「テキスト + 画像（inlineData）」という構造は似ています。
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt,
                    },
                    {
                        "inlineData": {
                            # ここでは汎用的に image/png を使います。
                            # 必要に応じて元画像のMIMEタイプに合わせて変更してください。
                            "mimeType": "image/png",
                            "data": image_b64,
                        }
                    },
                ]
            }
        ]
    }

    url = f"{settings.endpoint}/{settings.model}:generateContent"
    params = {"key": settings.api_key}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, params=params, json=payload)
    except httpx.HTTPError as exc:
        # ネットワークエラーなど
        raise GeminiAPIError(f"Gemini API への接続に失敗しました: {exc}") from exc

    if resp.status_code >= 400:
        # エラー時のメッセージを分かりやすくする
        try:
            data = resp.json()
        except Exception:
            data = {}
        detail = data.get("error", {}).get("message") if isinstance(data, dict) else None
        msg = detail or f"Gemini API エラー (status={resp.status_code})"
        raise GeminiAPIError(msg)

    data = resp.json()

    # レスポンスから画像（inlineData）を探す
    try:
        candidates = data.get("candidates") or []
        for cand in candidates:
            content = cand.get("content") or {}
            parts = content.get("parts") or []
            for part in parts:
                inline = part.get("inlineData")
                if inline and "data" in inline:
                    return base64.b64decode(inline["data"])
    except Exception as exc:  # 解析時の予期せぬエラー
        raise GeminiAPIError(f"Gemini API レスポンスの解析に失敗しました: {exc}") from exc

    raise GeminiAPIError("Gemini API から画像データが返されませんでした。設定やモデルを確認してください。")


async def generate_quadrant_avatars(
    image_path: Path,
    staff_name: str,
) -> Dict[str, bytes]:
    """
    1枚の元画像から「4象限用のアバター画像」を生成します。

    戻り値のイメージ:
        {
            \"q1\": b\"...\",  # 第1象限（重要かつ緊急）用の画像バイナリ
            \"q2\": b\"...\",  # 第2象限（重要だが緊急ではない）
            \"q3\": b\"...\",  # 第3象限（緊急だが重要ではない）
            \"q4\": b\"...\",  # 第4象限（重要でも緊急でもない）
        }

    ここでは4回APIを呼び出して、それぞれ別のプロンプトで画像を生成しています。
    （将来的にAPI側で「一度に複数パターン生成」がサポートされたら、1回の呼び出しにまとめることも可能です）
    """

    settings = GeminiSettings.from_env()

    # 各象限ごとのプロンプト（日本語で丁寧に指示）
    # 重要ポイント:
    # - 「同じ人物のままにする」ことを毎回明示する
    # - どんな表情・シチュエーションにしたいかを具体的に書く
    base_intro = (
        f"この画像の人物「{staff_name}」をもとに、同じ人物であることが分かるように顔立ちや雰囲気を保ったまま、"
        "表情や状況だけを編集してください。背景はオフィスや仕事中の雰囲気で構いません。"
    )

    prompts = {
        "q1": (
            base_intro
            + "アイゼンハワーマトリクスの第1象限（重要かつ緊急）にふさわしい画像にします。"
            "人物は怒っていて、時間や締め切りに追われているような緊迫した表情にしてください。"
        ),
        "q2": (
            base_intro
            + "アイゼンハワーマトリクスの第2象限（重要だが緊急ではない）にふさわしい画像にします。"
            "人物は前向きでやる気に満ちた、落ち着いて計画的に仕事を進めているような表情にしてください。"
        ),
        "q3": (
            base_intro
            + "アイゼンハワーマトリクスの第3象限（緊急だが重要ではない）にふさわしい画像にします。"
            "人物は電話や通知、雑務に追われて少し困っているような表情にしてください。"
        ),
        "q4": (
            base_intro
            + "アイゼンハワーマトリクスの第4象限（重要でも緊急でもない）にふさわしい画像にします。"
            "人物がデスクでお茶を飲みながらリラックスしている、穏やかな表情の様子にしてください。"
        ),
    }

    results: Dict[str, bytes] = {}
    # 1つずつ順番に生成（実装をシンプルにするため）
    for key, prompt in prompts.items():
        img_bytes = await _generate_single_image(image_path=image_path, prompt=prompt, settings=settings)
        results[key] = img_bytes

    return results


