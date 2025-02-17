# receipt_camera
# 要件定義 (Requirements)

## 1. 背景・目的
本アプリケーションは、領収書の画像から日付・金額・支払先・摘要などの必要な情報を効率的に抽出し、ユーザーがそれらを確認・編集できる機能を提供する。  
紙の領収書を電子化して管理したいというニーズに応えるため、ブラウザ上でOCR（文字認識）を行い、入力作業を簡略化することを目的とする。

## 2. 対象範囲
- 対象ファイル形式: JPEG, PNG などの一般的な画像フォーマット
- 対象デバイス: PCおよびモバイルデバイスのブラウザ

## 3. 利用想定シナリオ
1. ユーザーが領収書画像をアップロードする。  
2. システムが領収書を自動で四隅検出し、補正した画像を表示する。  
3. ユーザーが必要に応じて四隅の位置を調整し、補正画像を確定する。  
4. ユーザーが次の画面へ進み、OCR結果を基に日付・金額・支払先・摘要などの項目を入力フィールドへ自動貼り付けする。  
5. 必要に応じてユーザーが内容を修正し、最終的なデータとして保存する／または別システムへ連携する。

## 4. 機能要件

### 4.1. 画像アップロード機能
- **必須**: ユーザーが画像ファイルを選択できる  
- **必須**: アップロードした画像をキャンバスに表示する  

### 4.2. 自動切り出し＆補正機能
- **必須**: 画像から領収書の四隅を自動検出（Cannyエッジ検出などを用いた輪郭抽出）  
- **必須**: 検出した四隅をキャンバス上に可視化しドラッグ可能にする  
- **必須**: 四隅を用いて透視変換を行い、補正結果をユーザーに提示する  

### 4.3. 画像変換機能
- **必須**: 補正後の画像を回転・反転できる（90°回転、-90°回転、左右反転）  
- **必須**: 回転・反転した結果を再度OCR画面に反映する  

### 4.4. 全体OCR機能
- **必須**: 補正後の画像に対して日本語OCRを実行し、結果をテキスト化する  
- **必須**: OCR結果の単語ごとにバウンディングボックスを生成する  
- **必須**: 単語群を行単位でグループ化し、さらに横方向でグループ化する  
  - グループを赤枠で可視化する  

### 4.5. 部分OCR（フィールドOCR）機能
- **必須**: ユーザーが日付・金額・支払先・摘要などの項目領域をドラッグで指定可能  
- **必須**: ドラッグ指定領域に対してOCRを個別に実行できる  
- **必須**: 金額が複数領域にまたがる場合、合算結果を金額フィールドへ出力可能  

### 4.6. グループ・フィールド間の連携機能
- **必須**: 全体OCR後に、赤枠のグループをクリックで選択し、そのテキストをフィールドに貼り付けられる  
- **必須**: ユーザーがどの入力フィールドにフォーカスしているかを管理し、クリックしたグループのテキストをそのフィールドに入力する  

### 4.7. その他のテキスト処理
- **必須**: 囲み数字（①など）を通常数字に置換する  
- **必須**: 和暦を西暦に変換する（令和 → 20xx年）  
- **必須**: 日付・金額などのフィールド独自フォーマットの整形機能（数字以外の除去など）  

## 5. 非機能要件

### 5.1. パフォーマンス
- ブラウザ上で動作し、一般的なPC・スマートフォンでOCRを実行可能な速度を担保する  
  （Tesseract.jsの速度目安を考慮）

### 5.2. 信頼性・可用性
- オフライン（ネットワーク不安定）環境でも基本機能が利用できることが望ましい  
  （ただし、ライブラリの読み込みが完了している必要はある）

### 5.3. ユーザビリティ
- 手動操作（四隅の微調整、フィールドドラッグ）は直感的に操作できるUIとする  
- エラー発生時はアラート表示や画面メッセージでユーザーに通知する  

### 5.4. 保守性
- 将来的に英語など他言語へも拡張可能な構成  
  （Tesseract.jsの言語拡張を想定）

## 6. 関連システム・連携要件
- 本アプリ自体は単体で動作するが、外部へのデータエクスポート（CSV, JSONなど）が必要になる場合が想定される  
- 連携先の仕様に合わせてフィールド内容の編集やフォーマット変換が必要となる可能性がある

## 7. 制約
- Tesseract.jsやOpenCV.jsのライブラリ読み込みに時間がかかる場合がある  
- ブラウザの種類やバージョンによっては動作しない可能性がある  

# 設計書 (Design)

## 1. アーキテクチャ概要
- **言語**: HTML, CSS, JavaScript (Vanilla)
- **主要ライブラリ**:
  - [Tesseract.js](https://github.com/naptha/tesseract.js): ブラウザ上でOCRを実行するためのライブラリ  
  - [OpenCV.js](https://docs.opencv.org/): 画像処理（四隅検出、透視変換、二値化など）を行う  
- **構成**: フロントエンドのみ（サーバーサイドの処理なし）  
  - 画像は `<input type="file">` で読み込み、ブラウザのメモリ上で処理  
  - 結果テキストもブラウザ上で保持  

## 2. 画面設計

### 2.1. 画面1: 画像切り出し＆補正（screen1）
- **主なUI要素**  
  1. 画像アップロード（`<input type="file">`）  
  2. 画像表示用キャンバス（`<canvas id="pcCanvas">`）  
  3. 「自動切り出し＆補正」ボタン  
  4. 「ポイント確定」ボタン  
  5. 補正結果画像（`<img id="correctedImage">`）  
  6. 画像の回転・反転ボタン（90°回転、-90°回転、左右反転）  
  7. 「次へ」ボタン  

- **画面フロー**  
  1. ファイルを選択すると `pcCanvas` に表示  
  2. 「自動切り出し＆補正」を押下すると、Cannyエッジ検出＋輪郭抽出により四隅を推定  
  3. 四隅のドラッグ調整が可能  
  4. 「ポイント確定」を押下すると、透視変換を実行し、`correctedImage`へ結果を表示  
  5. 回転や反転ボタンを用いて向きを合わせる  
  6. 「次へ」を押すと画面2へ遷移  

### 2.2. 画面2: フィールド選択＆OCR（screen2）
- **主なUI要素**  
  1. OCR進捗表示領域（`<div id="ocrOutput">`）  
  2. 補正後画像表示用キャンバス（`<canvas id="fsCanvas">`）  
  3. 日付・金額・支払先・摘要の入力フィールド  
  4. 領域ドラッグ選択 + OCR実行ボタン（全体 / 個別）  
  5. グループ化パラメータ調整スライダー  

- **画面フロー**  
  1. 画面遷移時に自動で全体OCRを実行し、その結果をグループ化して赤枠を表示  
  2. フィールド選択ドロップダウンで「日付」「金額」「支払先」「摘要」を選び、キャンバス上でドラッグすると、赤枠が表示される  
  3. 「フィールドリセット」でユーザー指定領域をクリアできる  
  4. 「選択領域でOCR実行」ボタンを押すと、指定領域に対してOCRを実行し、テキストボックスへ反映  
    - 金額フィールドは複数領域を合算して一つのフィールドに反映できる  
  5. 全体OCR結果の赤枠上をクリックすると、クリックしたグループをオレンジ枠でハイライトし、テキストを入力フォームへ貼り付ける  
  6. スライダー（行グループ化閾値, 横方向重なり閾値）でグループ化の粒度を調整し、赤枠を再描画  

## 3. データフロー

1. **画像ファイル入力**  
   - `<input type="file">` でユーザーが画像を選択  
   - JSで `FileReader` を用いてDataURLとして読み込み  
   - 画像オブジェクト（`pcImage` / `fsImage`）にセットし、キャンバスへ描画  

2. **画像処理（OpenCV.js）**  
   - Cannyエッジ検出 → 輪郭抽出 → 4点推定  
   - 四隅の座標情報を保持し、ユーザーがドラッグ操作で微調整  
   - 4点座標 + 画像に対して `warpPerspective` を行い、補正された画像を生成  

3. **OCR処理（Tesseract.js）**  
   - `Tesseract.recognize()` を用いて全体 / 部分のOCR  
   - 結果は `words` 配列等の構造で返され、各単語ごとに座標やテキスト情報を保持  
   - 結果テキストを入力フォームへ反映  

4. **グループ化（行単位・横単位）**  
   - OCR結果の単語座標を回転補正（傾き計算）  
   - 縦方向に行としてグループ化 → 各行の中で水平距離に応じてさらにグループ分割  
   - グループ単位でバウンディングボックスを作成し、キャンバス上に赤枠で描画  
   - クリックで選択し、対応フィールドへ貼り付け  

5. **テキスト整形**
   - 囲み数字の変換（① → 1）  
   - 和暦の日付を西暦へ変換（令和5年 → 2023年）  
   - 金額フィールドでは数字のみ抽出  

## 4. 主要クラス・モジュール設計

> 実装上はHTML/JSのみだが、論理的なモジュールとして以下を想定。

1. **AutoCropModule**
   - 四隅検出（Canny → findContours）
   - 透視変換実行  

2. **TransformModule**
   - 画像回転／反転処理  

3. **OcrModule**
   - 全体OCR＆結果格納
   - 部分OCR（領域クロップ → 二値化 → OCR）  

4. **GroupingModule**
   - 単語の座標計算・傾き補正
   - 行単位・横方向グループ化ロジック  

5. **UIController**
   - PCキャンバス描画制御
   - FSキャンバス描画制御
   - イベントハンドラ（クリック、ドラッグ、スライダー操作など）  

## 5. インタフェース

1. **HTML要素 → JSとの紐づけ**  
   - `document.getElementById` や `querySelector` を用いて各要素を取得し、イベント登録  

2. **API/外部連携**  
   - **Tesseract.js**: `Tesseract.createWorker()`, `Tesseract.recognize()`  
   - **OpenCV.js**: `cv.imread()`, `cv.Canny()`, `cv.findContours()`, `cv.warpPerspective()` など  

## 6. 例外・エラー処理
- 画像未選択で「自動切り出し」や「次へ」が押された場合はアラート表示  
- OCR処理中のエラーは `console.error` だけでなく、ユーザーにわかる形でメッセージを表示  
- 四隅が検出できなかった場合はデフォルトの枠を設定  

## 7. テスト観点

1. **機能テスト**  
   - 正常系: 四隅検出が成功した場合に補正画像が生成される  
   - 正常系: 全体OCRが正常に終了し、グループ化結果が赤枠表示される  
   - 異常系: 輪郭検出がうまくいかない画像（白飛びなど）でアプリが動作し続けるか  

2. **UIテスト**  
   - PC・スマートフォンの画面サイズを想定したCanvas描画の確認  
   - 4隅ドラッグ操作、領域ドラッグ操作が期待通りに動作するか  

3. **パフォーマンステスト**  
   - 大きい解像度の画像を処理した際にブラウザがフリーズしないか  

## 8. 運用・保守
- ブラウザのキャッシュを利用し、離脱からの復帰時に途中までの状態を保持する仕様は未実装  
- ライブラリのバージョンアップに伴う変更点を確認し、定期的に動作確認を行う  
