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

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict
from uuid import uuid4
import mimetypes

import google.genai as genai
from google.genai import types as genai_types


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
            "https://generativelanguage.googleapis.com",
        )
        # 画像生成用のデフォルトモデルは gemini-2.5-flash-image を使用します。
        # 必要に応じて GEMINI_IMAGE_MODEL 環境変数で上書きしてください。
        model = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
        return cls(api_key=api_key, endpoint=endpoint, model=model)


async def _generate_single_image(
    image_path: Path,
    prompt: str,
    settings: GeminiSettings,
) -> bytes:
    """
    1枚の入力画像 + テキストプロンプトから、1枚の画像を生成してバイナリを返します。

    実装イメージ（SDK版）:
    - 画像ファイルをバイト列として読み込む
    - google-genai の `GenerativeModel` に対して
      「テキストパート＋画像パート」をまとめて渡し、`generate_content` を実行
    - レスポンスの `inline_data` から生成された画像バイト列を取り出す
    """

    if not image_path.exists():
        raise GeminiAPIError(f"入力画像が見つかりません: {image_path}")

    # 画像ファイルをバイナリとして読み込む
    image_bytes = image_path.read_bytes()

    try:
        # SDKのクライアントを初期化
        client = genai.Client(api_key=settings.api_key)

        # google-genai の型（Content / Part）を使って
        # 「テキスト + 画像」の入力を組み立てる
        # from_text / from_bytes はキーワード引数で渡す必要がある
        text_part = genai_types.Part.from_text(text=prompt)
        image_part = genai_types.Part.from_bytes(
            mime_type="image/png",
            data=image_bytes,
        )
        content = genai_types.Content(
            role="user",
            parts=[text_part, image_part],
        )

        # テキスト＋画像をまとめて渡して画像生成を依頼
        response = client.models.generate_content(
            model=settings.model,
            contents=[content],
        )
    except Exception as exc:  # SDKレイヤーでのエラー
        raise GeminiAPIError(f"Gemini SDK の呼び出しに失敗しました: {exc}") from exc

    # レスポンスから画像（inline_data）を探す
    try:
        for candidate in getattr(response, "candidates", []) or []:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []) or []:
                inline = getattr(part, "inline_data", None)
                if inline is not None and getattr(inline, "data", None):
                    # inline.data はすでにバイト列である想定
                    return inline.data
    except Exception as exc:
        raise GeminiAPIError(f"Gemini SDK レスポンスの解析に失敗しました: {exc}") from exc

    raise GeminiAPIError("Gemini SDK から画像データが返されませんでした。モデルやレスポンス形式を確認してください。")


async def _generate_image_from_text(
    prompt: str,
    settings: GeminiSettings,
) -> bytes:
    """
    テキストプロンプトのみから1枚の画像を生成し、バイト列として返します。

    - 元画像（アップロード画像）は使わず、「こういう雰囲気の画像を作って」と頼む形です。
    - まずはAPIの挙動を確認するための簡易版として利用します。
    """

    # SDKのクライアントを初期化
    try:
        client = genai.Client(api_key=settings.api_key)

        content = genai_types.Content(
            role="user",
            parts=[genai_types.Part.from_text(text=prompt)],
        )

        generate_config = genai_types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        )

        response = client.models.generate_content(
            model=settings.model,
            contents=[content],
            config=generate_config,
        )
    except Exception as exc:
        raise GeminiAPIError(f"Gemini SDK の呼び出しに失敗しました: {exc}") from exc

    # レスポンスから画像（inline_data）を探す
    try:
        for candidate in getattr(response, "candidates", []) or []:
            content = getattr(candidate, "content", None)
            if not content:
                continue
            for part in getattr(content, "parts", []) or []:
                inline = getattr(part, "inline_data", None)
                if inline is not None and getattr(inline, "data", None):
                    return inline.data
    except Exception as exc:
        raise GeminiAPIError(f"Gemini SDK レスポンスの解析に失敗しました: {exc}") from exc

    raise GeminiAPIError("テキストのみからの画像生成で画像データが返されませんでした。モデル設定を確認してください。")


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
    # ※ 現時点ではアップロード画像（image_path）は使用せず、テキストから直接生成します。
    for key, prompt in prompts.items():
        img_bytes = await _generate_image_from_text(prompt=prompt, settings=settings)
        results[key] = img_bytes

    return results


async def edit_image_with_prompt(
    image_path: Path,
    prompt: str,
    output_dir: Path,
) -> str:
    """
    入力画像 + テキストプロンプトから、1枚の編集済み画像を生成してファイル保存します。

    - 例: 人物の写真をアップロードして「怒っている表情にして」と指示すると、
      その人物が怒っている画像が生成されます。
    - UI からの「画像編集テストボタン」で動作確認する用途を想定しています。

    引数:
        image_path: 入力画像のパス
        prompt: 編集内容の指示（テキストプロンプト）
        output_dir: 生成画像の保存先ディレクトリ

    戻り値:
        保存したファイル名（ファイル名のみ、パスは含まない）
    """

    settings = GeminiSettings.from_env()

    if not image_path.exists():
        raise GeminiAPIError(f"入力画像が見つかりません: {image_path}")

    # 画像ファイルをバイナリとして読み込む
    image_bytes = image_path.read_bytes()

    # 画像のMIMEタイプを推測
    mime_type = mimetypes.guess_type(str(image_path))[0] or "image/png"

    try:
        # SDKのクライアントを初期化
        client = genai.Client(api_key=settings.api_key)

        # テキストパートと画像パートを作成
        text_part = genai_types.Part.from_text(text=prompt)
        image_part = genai_types.Part.from_bytes(
            mime_type=mime_type,
            data=image_bytes,
        )

        content = genai_types.Content(
            role="user",
            parts=[text_part, image_part],
        )

        # 画像を返してほしいことを明示する
        generate_config = genai_types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        )

        # ストリーミングレスポンスから最初の画像を見つけて保存
        stream = client.models.generate_content_stream(
            model=settings.model,
            contents=[content],
            config=generate_config,
        )
    except Exception as exc:
        raise GeminiAPIError(f"Gemini SDK の呼び出しに失敗しました: {exc}") from exc

    for chunk in stream:
        candidates = getattr(chunk, "candidates", None) or []
        if not candidates:
            continue
        content = candidates[0].content
        if not content or not getattr(content, "parts", None):
            continue
        part = content.parts[0]
        inline = getattr(part, "inline_data", None)
        if inline is None or getattr(inline, "data", None) is None:
            # 画像でない場合はテキストとしてログに出すだけ
            text = getattr(chunk, "text", None)
            if text:
                print(f"[GeminiEdit text] {text}")
            continue

        data_bytes = inline.data
        output_mime_type = getattr(inline, "mime_type", "image/png")
        ext = mimetypes.guess_extension(output_mime_type) or ".png"
        filename = f"gemini_edit_{uuid4().hex}{ext}"
        output_path = output_dir / filename
        output_path.write_bytes(data_bytes)
        return filename

    raise GeminiAPIError("画像編集に失敗しました。モデル設定とレスポンスを確認してください。")


async def generate_test_image_from_text(
    prompt: str,
    output_dir: Path,
) -> str:
    """
    単純なテキストプロンプトから 1 枚の画像を生成し、ファイルとして保存します。

    - 公式の Google AI Studio サンプルコードをベースにした構成です。
    - UI からの「お試しボタン」で Gemini API が正しく動いているか確認する用途を想定しています。

    戻り値:
        保存したファイル名（相対パスではなくファイル名のみ）
    """

    settings = GeminiSettings.from_env()

    # クライアントを初期化
    client = genai.Client(api_key=settings.api_key)

    # テキストのみで Content を組み立てる
    contents = [
        genai_types.Content(
            role="user",
            parts=[
                genai_types.Part.from_text(text=prompt),
            ],
        )
    ]

    # 画像を返してほしいことを明示する
    generate_config = genai_types.GenerateContentConfig(
        response_modalities=["IMAGE", "TEXT"],
    )

    # ストリーミングレスポンスから最初の画像を見つけて保存
    try:
        stream = client.models.generate_content_stream(
            model=settings.model,
            contents=contents,
            config=generate_config,
        )
    except Exception as exc:
        raise GeminiAPIError(f"Gemini SDK の呼び出しに失敗しました: {exc}") from exc

    for chunk in stream:
        candidates = getattr(chunk, "candidates", None) or []
        if not candidates:
            continue
        content = candidates[0].content
        if not content or not getattr(content, "parts", None):
            continue
        part = content.parts[0]
        inline = getattr(part, "inline_data", None)
        if inline is None or getattr(inline, "data", None) is None:
            # 画像でない場合はテキストとしてログに出すだけ
            text = getattr(chunk, "text", None)
            if text:
                print(f"[GeminiTest text] {text}")
            continue

        data_bytes = inline.data
        mime_type = getattr(inline, "mime_type", "image/png")
        ext = mimetypes.guess_extension(mime_type) or ".png"
        filename = f"gemini_test_{uuid4().hex}{ext}"
        output_path = output_dir / filename
        output_path.write_bytes(data_bytes)
        return filename

    raise GeminiAPIError("テスト画像が生成されませんでした。モデル設定とレスポンスを確認してください。")


