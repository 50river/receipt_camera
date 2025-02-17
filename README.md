# receipt_camera
# 要件定義書 (Requirements)

## 1. 背景・目的
本アプリケーションは、領収書の画像から日付・金額・支払先・摘要・備考などの必要な情報をOCR（文字認識）により抽出・編集し、入力作業を支援することを目的としています。  
特に金額については複数箇所の金額を足し引きして合算する機能を実装し、領収書上に複数の金額が記載されている場合でも合計しやすい仕組みを提供します。

## 2. 対象範囲
- **対象ファイル形式**: JPEG, PNG などの一般的な画像形式  
- **対象デバイス**: PC・モバイル端末のブラウザ  

## 3. 利用想定シナリオ
1. ユーザーが領収書画像をアップロードする  
2. システムが領収書の四隅を自動検出し、補正した画像をユーザーに提示  
3. 必要に応じてユーザーが四隅位置をドラッグ調整し、補正を確定  
4. OCR画面（画面2）へ切り替え、システムが全体OCRを実行する  
5. 全体OCRの結果を赤枠で表示し、ユーザーがタップまたはクリックで任意の赤枠を選択  
   - 金額フィールドが選択されていれば「計算用ダイアログ」を表示  
   - それ以外のフィールド（日付、支払先、摘要、備考）であれば「通常ダイアログ」を表示  
6. ダイアログを通じてテキストを確認・修正し、入力フォームへ反映  
   - 金額ダイアログの場合は「＋」「－」ボタンで式に追加し、「＝」で合計を確定できる  
   - 計算内容は備考欄へ自動的に注記される  
7. 最終的にユーザーが入力内容を確認し、システムへの登録やダウンロード等を行う（将来的拡張）

## 4. 機能要件

### 4.1. 画像アップロード
- **必須**: 画像ファイルを `<input type="file">` で選択し、ブラウザ内部に読み込む  
- **必須**: 読み込んだ画像をPCキャンバス（`pcCanvas`）に表示  

### 4.2. 自動切り出し＆補正
- **必須**: Cannyエッジ検出+輪郭抽出により領収書の四隅を自動検出  
- **必須**: 4点が自動検出できなかった場合、デフォルトの枠を作成  
- **必須**: ユーザーがドラッグ操作で四隅を再調整可能  
- **必須**: ポイント確定で透視変換を行い補正画像を生成  

### 4.3. 補正画像の回転・反転
- **必須**: 90度回転・-90度回転・左右反転を行い、補正画像を再生成  
- **必須**: 補正画像は次のOCR処理に反映  

### 4.4. 全体OCR機能
- **必須**: 全体OCRを行い、テキスト認識結果を `words` 等で受け取る  
- **必須**: Tesseract.jsの認識進捗を `<progress>` 要素で表示する  

### 4.5. テキストグループ化
- **必須**: OCR結果の単語を行方向→列方向にグループ分割し、赤枠で表示する  
- **必須**: ユーザーが赤枠をクリックすると、その領域の文字がダイアログに表示される  

### 4.6. 部分OCR（ダイアログ）機能
- **金額ダイアログ**  
  - **必須**: 金額を入力させるためのダイアログを表示し、OCR結果を初期値とする  
  - **必須**: 「＋」「－」「＝」「キャンセル」ボタンがあり、計算式を管理  
  - **必須**: ユーザーが「＋」「－」を押すと calcSequence に値が蓄積され、最終「＝」で合計を金額フィールドへ反映  
  - **必須**: 計算式を備考欄(`noteField`)へ記載し、将来的に参照しやすくする  

- **通常ダイアログ**  
  - **必須**: 金額以外の項目の場合は、シンプルなダイアログでOCR結果を表示・編集後にOKでフィールドに反映  

### 4.7. 入力フォーム
- **必須**: 日付・金額・支払先・摘要・備考の5項目  
- **必須**: 日付フィールドがフォーカスされている時に赤枠をクリックすると、通常ダイアログが表示される  
- **必須**: 金額フィールドがフォーカスされている時に赤枠をクリックすると、計算ダイアログが表示される  
- **必須**: そのほかのフィールド（支払先・摘要・備考）がフォーカスされている場合も通常ダイアログを表示  

### 4.8. フィールドリセット
- **必須**: 「フィールドリセット」ボタンで、ユーザーの選択した領域やグループ選択情報、計算式などを初期化  

### 4.9. 補足的テキスト処理
- **必須**: 囲み数字を通常の数字に置換  
- **必須**: 和暦の日付を西暦に変換する  
- **必須**: 金額フィールドでは数値以外を除去し、計算用に使用  

## 5. 非機能要件

### 5.1. パフォーマンス
- ブラウザ上でリアルタイムに動作することを考慮し、一般的な環境で使用可能な速度を保つ  

### 5.2. 信頼性・可用性
- 画像の読み込みやOCR処理でエラーが起きても、画面がフリーズしないように設計  
- エラー時にはメッセージを表示する  

### 5.3. ユーザビリティ
- スマートフォンでも操作しやすいUI（ボタンの大きさ、タッチ領域など）  
- ダイアログは最前面表示し、ユーザーが容易にテキスト編集できる  

### 5.4. 保守性
- Tesseract.jsやOpenCV.jsのバージョンアップに伴う変更に対応しやすい構成  
- 計算機能（calcSequence）などが他フィールドにも流用できるよう簡潔にまとめる  

## 6. 関連システム・連携要件
- 外部データ送信は未実装だが、将来的にAPIやファイル出力などが想定される  
- 金額計算結果の書式（フォーマット）や別システム連携時の丸め方法など要検討  

## 7. 制約
- ブラウザの種類・バージョンによっては動作しない可能性がある  
- 大きいサイズの画像や複雑な文字配置の場合、OCRや輪郭検出が遅延する可能性がある  

## 8. 今後の拡張予定
- 複数領収書を連続で取り込み、計算結果をまとめる機能  
- 選択した領域の内容を自動でフィールド種別判定する機能（AIなどの活用）  
- OCR結果の高精度化に向けた前処理・文字候補列挙機能  

---

# 設計書 (Design)

## 1. アーキテクチャ概要
- **言語**: HTML, CSS, JavaScript (Vanilla)  
- **主要ライブラリ**:  
  - **Tesseract.js**: OCR実行用  
  - **OpenCV.js**: 画像処理（四隅検出、透視変換、二値化など）  
- **構成**: フロントエンドのみ（サーバーサイドは想定しない）  
  - 入力画像は `<input type="file">` で取得し、ブラウザ内部メモリで処理  
  - OCR結果などはブラウザ内で保持  

## 2. 画面設計

### 2.1. 画面1: 画像切り出し＆補正
- **要素**  
  1. `imageInput`: `<input type="file">` で画像を選択  
  2. `pcCanvas`: 読み込んだ画像と四隅を表示するキャンバス  
  3. `autoCropButton`: 自動四隅検出を実行  
  4. `confirmPointsButton`: 四隅を確定して透視変換  
  5. `correctedImage`: 補正後の画像をプレビュー表示  
  6. `transformControls`: 90°回転、-90°回転、左右反転ボタン  
  7. `nextToScreen2`: 次の画面へ移動  

- **フロー**  
  1. 画像選択 → `pcCanvas` に縮尺調整して表示  
  2. 「自動切り出し」 → Cannyエッジ + 輪郭抽出で最大四角を検出  
  3. 必要に応じてドラッグで調整 → 「ポイント確定」で透視変換し `correctedImage` に反映  
  4. 回転や反転ボタンで向きを合わせた後、「次へ」で画面2へ遷移  

### 2.2. 画面2: フィールド選択＆OCR
- **要素**  
  1. `ocrProgress`: 全体OCRの進捗を示す `<progress>`  
  2. `fsCanvas`: 補正後の画像に対してOCRグループの赤枠を表示するキャンバス  
  3. 入力フィールド:  
     - `dateField`: 日付  
     - `amountField`: 金額  
     - `payeeField`: 支払先  
     - `descriptionField`: 摘要  
     - `noteField`: 備考  
  4. `amountExpression`, `amountTotalDisplay`: 金額の計算式および合計を表示  
  5. `fsResetButton`: フィールドリセット  
  6. `ocrWholeButton`: 全体OCR実行ボタン  
  7. `backToScreen1`: 前の画面へ戻る  

- **フロー**  
  1. `nextToScreen2` から画面遷移 → 自動的に `ocrWholeButton.click()` が呼ばれ、全体OCRを開始  
  2. OCR結果の単語をグループ化して赤枠表示  
  3. 入力フォームにフォーカス → その状態で赤枠をクリックすると以下の処理:
     - **金額フィールドがフォーカス** → `calcDialog`（金額用ダイアログ）を表示  
     - **その他フィールドがフォーカス** → `simpleDialog`（通常ダイアログ）を表示  
  4. ダイアログでOCR結果を確認・修正し、OK or 「＋」「－」「＝」を押下 → フィールド反映  
  5. 必要に応じて「フィールドリセット」で全て初期化  
  6. 戻る → 画面1 へ遷移可能  

## 3. データフロー

1. **画像読み込み (`imageInput`)**  
   - `FileReader` で DataURL 取得 → `pcImage.src` に格納 → `pcCanvas` に描画  

2. **自動切り出し & 透視変換 (OpenCV)**  
   - `autoCrop()` で Cannyエッジ検出 → `findContours()` → 4点抽出  
   - `warpPerspective()` で補正 → `<img id="correctedImage">` に反映  
   - 回転・反転後は `correctedImage` と `fsImage` に反映  

3. **全体OCR (Tesseract.js)**  
   - `ocrWholeButton.click()` → `Tesseract.createWorker()` でワーカー生成 → `recognize()`  
   - `words` 配列取得 → グループ化処理で赤枠ボックス(`lastGroupBoxes`)を算出  
   - `ocrProgress` で進捗表示  

4. **グループクリック → ダイアログ表示**  
   - `fsCanvas.addEventListener("click")` で赤枠のクリックを検知  
   - フォーカス中のフィールドに応じて `calcDialog` or `simpleDialog`  
   - OCR結果は `groupOcrResults` にキャッシュし、なければ `performOCROnField()` で再OCR  

5. **ダイアログ処理**  
   - **金額用 (`calcDialog`)**: 「＋」「－」で演算子を `calcSequence` に追加 → 「＝」で合計確定、備考欄へ計算式を記載  
   - **通常用 (`simpleDialog`)**: 文字列を修正後OKで対象フィールドに貼り付け  

6. **フィールドリセット**  
   - ユーザー指定領域、グループ選択、計算式、OCR結果キャッシュなどを初期化  
   - `drawFsCanvas()` で再表示  

## 4. 主要モジュール

1. **AutoCropModule**
   - 四隅検出 (Canny → findContours)
   - 透視変換 (warpPerspective)

2. **TransformModule**
   - 画像回転 (rotateImage)
   - 画像反転 (flipImage)

3. **OcrModule**
   - 全体OCR (Tesseract Worker)
   - 部分OCR (performOCROnField + binarizeImage)

4. **GroupingModule**
   - `computeAverageTilt()` で傾き平均を算出し、単語を回転補正  
   - `groupWordsByLineTilt()` → `groupWordsHorizontally()` で 2段階グループ化  
   - グループBox の算出

5. **UIController**
   - PCキャンバス (`pcCanvas`) と FSキャンバス (`fsCanvas`) の描画管理  
   - スクリーン切り替え (`showScreen`)  
   - ダイアログ操作（計算ダイアログ・通常ダイアログ）  
   - クリックイベントでのOCR結果貼り付けなど  

6. **CalcSequenceManager**
   - `calcSequence` を管理  
   - 「＋」「－」「＝」などの演算を解析  
   - 金額の最終合計を `amountField` に反映する  

## 5. インタフェース

- **HTML要素**: `document.getElementById()` / イベントリスナーで結合  
- **外部ライブラリ**:  
  - Tesseract.js: `createWorker`, `worker.recognize`, `worker.terminate`  
  - OpenCV.js: `cv.imread`, `cv.Canny`, `cv.findContours`, `cv.warpPerspective` など  

## 6. 例外・エラー処理
- 画像未選択で「自動切り出し」を押下した場合: アラート表示  
- OCRエラー時: `console.error` に加えて適切なメッセージを表示し処理続行  
- 四隅が検出できなかった場合: 画面中央にデフォルト枠を描画  

## 7. テスト観点

1. **機能テスト**  
   - 正常系: 四隅検出 → 補正 → 回転・反転 → 全体OCR → ダイアログ動作  
   - 異常系: 画像の縦横比や文字配置が極端な領収書で動作を確認  

2. **UIテスト**  
   - PC/モバイルでのタッチ・クリック操作が期待通り動作するか  
   - ダイアログの重なりやボタンタップが誤作動しないか  

3. **パフォーマンステスト**  
   - 解像度の大きい画像を読み込んだ場合の処理時間  
   - OCR進捗バーの表示がリアルタイムに更新されるか  

4. **計算機能テスト (金額ダイアログ)**  
   - 「＋」「－」「＝」の順序を変えた際の動作  
   - 0円や数字以外の文字を検出した場合の対処  

## 8. 運用・保守
- 将来拡張を想定し、関数をモジュール化  
- Tesseract.js / OpenCV.js のバージョン更新時にリグレッションテストを実施  
- ダイアログを複数設ける拡張などに備え、`calcDialog` / `simpleDialog` の実装を汎用的に管理  
