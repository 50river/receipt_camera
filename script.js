    /*************************************
     * グローバル変数
     *************************************/
    let lastGroupBoxes = [];    // 各グループの赤枠情報
    let lastOcrData = null;     // 全体OCR結果
    let groupOcrResults = {};   // 各グループのOCR結果
    let selectedGroupIndex = null; // 単一選択用
    let currentInput = null;    // 現在フォーカス中の入力フォーム
    // calcSequence：金額項目用の計算シーケンス（最初の値、その後「演算子」「値」のペア）
    let calcSequence = [];
    // ダイアログで処理中のグループインデックス（calcDialog用）
    let currentCalcGroupIndex = null;
    // simpleDialog用の現在のグループインデックス
    let currentSimpleGroupIndex = null;
    // 2セグメント用進捗保持変数（上部、下部）
    let segmentProgress = [0, 0];
    
    /*************************************
     * 入力フォームのフォーカス処理
     *************************************/
    ["dateField", "amountField", "payeeField", "descriptionField", "noteField"].forEach(id => {
      const input = document.getElementById(id);
      input.addEventListener("focus", function() {
        currentInput = this;
        if (id === "amountField") {
          calcSequence = [];
          document.getElementById("amountExpression").textContent = "";
          document.getElementById("amountTotalDisplay").textContent = "";
        }
        selectedGroupIndex = null;
      });
    });
    
    /*************************************
     * pasteOcrResultIntoInput
     * 金額以外の場合、選択されたグループのOCR結果を入力フォームに貼り付ける
     *************************************/
    function pasteOcrResultIntoInput() {
      if (currentInput && selectedGroupIndex !== null) {
        if (groupOcrResults.hasOwnProperty(selectedGroupIndex)) {
          currentInput.value = groupOcrResults[selectedGroupIndex];
          currentInput.focus();
          currentInput = null;
        } else {
          performOCROnField("selected", lastGroupBoxes[selectedGroupIndex])
            .then(resultText => {
              resultText = resultText.replace(/\s+/g, "");
              if (currentInput.id === "dateField") { resultText = processDateField(resultText); }
              groupOcrResults[selectedGroupIndex] = resultText;
              currentInput.value = resultText;
              currentInput.focus();
              currentInput = null;
            })
            .catch(err => console.error("OCR error:", err));
        }
      }
    }
    
    /*************************************
     * updateAmountCalculation
     * calcSequence に基づいて計算式と合計金額を更新（※金額項目用）
     *************************************/
    function updateAmountCalculation() {
      if (calcSequence.length === 0) return;
      let total = parseInt(calcSequence[0].value, 10) || 0;
      let expression = calcSequence[0].value;
      for (let i = 1; i < calcSequence.length; i += 2) {
        let opObj = calcSequence[i];
        let numObj = calcSequence[i+1];
        if (!opObj || !numObj) break;
        let op = opObj.operator;
        let num = parseInt(numObj.value, 10) || 0;
        if (op === "+") { total += num; expression += " + " + num; }
        else if (op === "-") { total -= num; expression += " - " + num; }
      }
      document.getElementById("amountExpression").textContent = expression;
      document.getElementById("amountTotalDisplay").textContent = total;
      amountField.value = total;
    }
    
    /*************************************
     * ダイアログ操作（calcDialog：金額項目用）
     *************************************/
    function openCalcDialog(groupIndex) {
      var box = lastGroupBoxes[groupIndex];
      var tempCanvas = document.createElement('canvas');
      tempCanvas.width = box.width / fsScale;
      tempCanvas.height = box.height / fsScale;
      var tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(fsImage, box.x / fsScale, box.y / fsScale, box.width / fsScale, box.height / fsScale, 0, 0, tempCanvas.width, tempCanvas.height);
      document.getElementById('calcDialogImage').src = tempCanvas.toDataURL();
      
      if (groupOcrResults.hasOwnProperty(groupIndex)) {
        document.getElementById('calcDialogValue').value = groupOcrResults[groupIndex];
        showCalcDialog(groupIndex);
      } else {
        performOCROnField("amount", box).then(resultText => {
          var cleaned = processAmountField(resultText.replace(/\s+/g, ""));
          groupOcrResults[groupIndex] = cleaned;
          document.getElementById('calcDialogValue').value = cleaned;
          showCalcDialog(groupIndex);
        });
      }
    }
    
    function showCalcDialog(groupIndex) {
      currentCalcGroupIndex = groupIndex;
      document.getElementById('calcDialog').style.display = 'block';
    }
    
    function closeCalcDialog() {
      document.getElementById('calcDialog').style.display = 'none';
      currentCalcGroupIndex = null;
    }
    
    document.getElementById('calcDialogPlus').addEventListener('click', function() {
      if (currentCalcGroupIndex !== null) {
        let newVal = document.getElementById('calcDialogValue').value;
        groupOcrResults[currentCalcGroupIndex] = newVal;
        // 常に入力値を追加してから演算子を記録
        calcSequence.push({ value: newVal });
        calcSequence.push({ operator: "+" });
        updateAmountCalculation();
        closeCalcDialog();
        drawFsCanvas();
      }
    });
    
    document.getElementById('calcDialogMinus').addEventListener('click', function() {
      if (currentCalcGroupIndex !== null) {
        let newVal = document.getElementById('calcDialogValue').value;
        groupOcrResults[currentCalcGroupIndex] = newVal;
        // 常に入力値を追加してから演算子を記録
        calcSequence.push({ value: newVal });
        calcSequence.push({ operator: "-" });
        updateAmountCalculation();
        closeCalcDialog();
        drawFsCanvas();
      }
    });
    
    document.getElementById('calcDialogEqual').addEventListener('click', function() {
      if (currentCalcGroupIndex !== null) {
        let newVal = document.getElementById('calcDialogValue').value;
        groupOcrResults[currentCalcGroupIndex] = newVal;
        if (calcSequence.length === 0) { 
          calcSequence.push({ value: newVal }); 
        } else {
          let last = calcSequence[calcSequence.length - 1];
          if (last.operator !== undefined) { calcSequence.push({ value: newVal }); }
        }
        updateAmountCalculation();
        // 複数項目の場合、備考欄に「計算式＝合計」を自動入力
        if(calcSequence.length > 1) {
          let expr = document.getElementById("amountExpression").textContent;
          let total = document.getElementById("amountTotalDisplay").textContent;
          document.getElementById('noteField').value = expr + "＝" + total;
        }
        closeCalcDialog();
        drawFsCanvas();
      }
    });
    
    document.getElementById('calcDialogCancel').addEventListener('click', function() {
      closeCalcDialog();
    });
    
    /*************************************
     * ダイアログ操作（simpleDialog：金額以外用）
     *************************************/
    function openSimpleDialog(groupIndex) {
      var box = lastGroupBoxes[groupIndex];
      var tempCanvas = document.createElement('canvas');
      tempCanvas.width = box.width / fsScale;
      tempCanvas.height = box.height / fsScale;
      var tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(fsImage, box.x / fsScale, box.y / fsScale, box.width / fsScale, box.height / fsScale, 0, 0, tempCanvas.width, tempCanvas.height);
      document.getElementById('simpleDialogImage').src = tempCanvas.toDataURL();
      
      if (groupOcrResults.hasOwnProperty(groupIndex)) {
        document.getElementById('simpleDialogValue').value = groupOcrResults[groupIndex];
        showSimpleDialog(groupIndex);
      } else {
        performOCROnField("nonAmount", box).then(resultText => {
          var cleaned = resultText.replace(/\s+/g, "");
          groupOcrResults[groupIndex] = cleaned;
          document.getElementById('simpleDialogValue').value = cleaned;
          showSimpleDialog(groupIndex);
        });
      }
    }
    
    function showSimpleDialog(groupIndex) {
      currentSimpleGroupIndex = groupIndex;
      document.getElementById('simpleDialog').style.display = 'block';
    }
    
    function closeSimpleDialog() {
      document.getElementById('simpleDialog').style.display = 'none';
      currentSimpleGroupIndex = null;
    }
    
    document.getElementById('simpleDialogOK').addEventListener('click', function() {
      if (currentSimpleGroupIndex !== null) {
        let newVal = document.getElementById('simpleDialogValue').value;
        groupOcrResults[currentSimpleGroupIndex] = newVal;
        if (currentInput) {
          currentInput.value = newVal;
          currentInput.focus();
          currentInput = null;
        }
        closeSimpleDialog();
        drawFsCanvas();
      }
    });
    
    document.getElementById('simpleDialogCancel').addEventListener('click', function() {
      closeSimpleDialog();
    });
    
    /*************************************
     * showScreen: 画面遷移処理
     * 「戻る」ボタン押下時は前回のOCR結果・枠情報・プログレスバーをリセット
     *************************************/
    function showScreen(screenId) {
      document.querySelectorAll('.screen').forEach(screen => { 
        screen.classList.toggle('active', screen.id === screenId); 
      });
      window.scrollTo(0, 0);
      if (screenId === 'screen1') {
        // 前回のFSの枠情報・OCR結果・進捗をクリア
        lastGroupBoxes = [];
        groupOcrResults = {};
        lastOcrData = null;
        segmentProgress = [0, 0];
        updateCustomProgressBar();
        drawPcCanvasWithPoints();
        // FS用のオーバーレイを再表示
        document.getElementById("ocrProgressOverlay").style.display = "block";
      }
      if (screenId === 'screen2') { 
        drawFsCanvas(); 
        ocrWholeButton.click(); 
      }
    }
    
    document.getElementById('nextToScreen2').addEventListener('click', function() {
      if (!correctedImage.src) { alert("補正結果画像がありません。"); return; }
      showScreen('screen2');
    });
    
    document.getElementById('backToScreen1').addEventListener('click', function() {
      showScreen('screen1');
    });
    
    /*************************************
     * 新規追加：そのまま取り込むボタン処理
     *************************************/
    document.getElementById('importAsIsButton').addEventListener('click', function() {
      if (!pcImage.src) { alert("画像が読み込まれていません。"); return; }
      // そのまま取り込む場合、元画像（pcImage）を補正画像として利用
      correctedImage.src = pcImage.src;
      fsImage.src = pcImage.src;
      showScreen('screen2');
    });
    
    /*************************************
     * PCモード：画像切り出し＆補正処理
     *************************************/
    let pcScale = 1;
    let detectedPoints = [];
    let draggingPointIndex = -1;
    const AREA_THRESHOLD = 10000;
    const pcCanvas = document.getElementById('pcCanvas');
    const pcCtx = pcCanvas.getContext('2d');
    let pcImage = new Image();
    
    const imageInput = document.getElementById('imageInput');
    const autoCropButton = document.getElementById('autoCropButton');
    const confirmPointsButton = document.getElementById('confirmPointsButton');
    const transformControls = document.getElementById('transformControls');
    
    imageInput.addEventListener('change', function(e) {
      if (e.target.files.length > 0) {
        const reader = new FileReader();
        reader.onload = event => { pcImage.src = event.target.result; };
        reader.readAsDataURL(e.target.files[0]);
      }
    });
    
    pcImage.onload = function() {
      const maxDisplayWidth = window.innerWidth - 40;
      pcScale = (pcImage.width > maxDisplayWidth) ? (maxDisplayWidth / pcImage.width) : 1;
      pcCanvas.width = pcImage.width * pcScale;
      pcCanvas.height = pcImage.height * pcScale;
      pcCtx.clearRect(0, 0, pcCanvas.width, pcCanvas.height);
      pcCtx.drawImage(pcImage, 0, 0, pcCanvas.width, pcCanvas.height);
      detectedPoints = [];
      confirmPointsButton.style.display = "none";
      transformControls.style.display = "none";
    };
    
    /*************************************
     * autoCrop: 画像から自動で4点検出してpcCanvasに描画
     *************************************/
    function autoCrop() {
      if (!pcImage.src) { alert("画像が読み込まれていません。"); return; }
      const srcMat = cv.imread(pcCanvas);
      const gray = new cv.Mat();
      cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY, 0);
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(7, 7), 0);
      const edges = new cv.Mat();
      cv.Canny(blurred, edges, 50, 150);
      const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
      const dilated = new cv.Mat();
      cv.dilate(edges, dilated, kernel);
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      
      let maxArea = 0, bestContour = null;
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4) {
          const area = cv.contourArea(approx);
          if (area > AREA_THRESHOLD && area > maxArea) {
            maxArea = area;
            if (bestContour !== null) bestContour.delete();
            bestContour = approx;
          } else { approx.delete(); }
        } else { approx.delete(); }
        cnt.delete();
      }
      hierarchy.delete(); edges.delete(); dilated.delete(); kernel.delete();
      blurred.delete(); gray.delete();
      
      if (bestContour === null) {
        const marginX = pcCanvas.width * 0.1;
        const marginY = pcCanvas.height * 0.1;
        detectedPoints = [
          { x: marginX, y: marginY },
          { x: pcCanvas.width - marginX, y: marginY },
          { x: pcCanvas.width - marginX, y: pcCanvas.height - marginY },
          { x: marginX, y: pcCanvas.height - marginY }
        ];
        drawPcCanvasWithPoints();
        confirmPointsButton.style.display = "inline-block";
        srcMat.delete();
        return;
      }
      
      detectedPoints = [];
      for (let i = 0; i < 4; i++) {
        detectedPoints.push({ x: bestContour.intAt(i, 0), y: bestContour.intAt(i, 1) });
      }
      bestContour.delete();
      detectedPoints = orderPoints(detectedPoints);
      drawPcCanvasWithPoints();
      confirmPointsButton.style.display = "inline-block";
      srcMat.delete();
    }
    
    /*************************************
     * orderPoints: 4点整列
     *************************************/
    function orderPoints(pts) {
      const sumArr = pts.map(p => p.x + p.y);
      const diffArr = pts.map(p => p.x - p.y);
      const tl = pts[sumArr.indexOf(Math.min(...sumArr))];
      const br = pts[sumArr.indexOf(Math.max(...sumArr))];
      const tr = pts[diffArr.indexOf(Math.min(...diffArr))];
      const bl = pts[diffArr.indexOf(Math.max(...diffArr))];
      return [tl, tr, br, bl];
    }
    
    /*************************************
     * drawPcCanvasWithPoints: PCキャンバス描画
     *************************************/
    function drawPcCanvasWithPoints() {
      pcCtx.clearRect(0, 0, pcCanvas.width, pcCanvas.height);
      pcCtx.drawImage(pcImage, 0, 0, pcCanvas.width, pcCanvas.height);
      detectedPoints.forEach(pt => {
        pcCtx.beginPath();
        pcCtx.arc(pt.x, pt.y, 15, 0, 2 * Math.PI);
        pcCtx.fillStyle = "blue";
        pcCtx.fill();
      });
      if (detectedPoints.length === 4) {
        pcCtx.beginPath();
        pcCtx.moveTo(detectedPoints[0].x, detectedPoints[0].y);
        for (let i = 1; i < 4; i++) { pcCtx.lineTo(detectedPoints[i].x, detectedPoints[i].y); }
        pcCtx.closePath();
        pcCtx.strokeStyle = "blue";
        pcCtx.lineWidth = 4;
        pcCtx.stroke();
      }
    }
    
    autoCropButton.addEventListener('click', autoCrop);
    
    /*************************************
     * PCキャンバス上のドラッグ操作
     *************************************/
    pcCanvas.addEventListener('pointerdown', function(e) {
      if (detectedPoints.length !== 4) return;
      e.preventDefault();
      const rect = pcCanvas.getBoundingClientRect();
      const scaleX = pcCanvas.width / rect.width;
      const scaleY = pcCanvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      draggingPointIndex = -1;
      for (let i = 0; i < 4; i++) { 
        if (Math.hypot(detectedPoints[i].x - x, detectedPoints[i].y - y) < 15) { 
          draggingPointIndex = i; 
          break; 
        } 
      }
    });
    
    pcCanvas.addEventListener('pointermove', function(e) {
      if (draggingPointIndex === -1) return;
      e.preventDefault();
      const rect = pcCanvas.getBoundingClientRect();
      const scaleX = pcCanvas.width / rect.width;
      const scaleY = pcCanvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      detectedPoints[draggingPointIndex] = { x, y };
      drawPcCanvasWithPoints();
    });
    
    pcCanvas.addEventListener('pointerup', e => { e.preventDefault(); draggingPointIndex = -1; });
    
    /*************************************
     * confirmPointsButton: 補正画像生成
     *************************************/
    confirmPointsButton.addEventListener('click', function() {
      if (detectedPoints.length !== 4) { alert("4点が設定されていません。"); return; }
      const ptsOriginal = detectedPoints.map(pt => ({ x: pt.x / pcScale, y: pt.y / pcScale }));
      const [tl, tr, br, bl] = orderPoints(ptsOriginal);
      const widthA = Math.hypot(br.x - bl.x, br.y - bl.y);
      const widthB = Math.hypot(tr.x - tl.x, tr.y - tl.y);
      const maxWidth = Math.max(widthA, widthB);
      const heightA = Math.hypot(tr.x - br.x, tr.y - br.y);
      const heightB = Math.hypot(tl.x - bl.x, tl.y - bl.y);
      const maxHeight = Math.max(heightA, heightB);
      
      const offCanvas = document.createElement('canvas');
      offCanvas.width = pcImage.width;
      offCanvas.height = pcImage.height;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(pcImage, 0, 0);
      const srcMat = cv.imread(offCanvas);
      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [ tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y ]);
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [ 0, 0, maxWidth - 1, 0, maxWidth - 1, maxHeight - 1, 0, maxHeight - 1 ]);
      const M = cv.getPerspectiveTransform(srcPts, dstPts);
      const dsize = new cv.Size(maxWidth, maxHeight);
      const dstMat = new cv.Mat();
      cv.warpPerspective(srcMat, dstMat, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = maxWidth;
      tempCanvas.height = maxHeight;
      cv.imshow(tempCanvas, dstMat);
      const croppedDataURL = tempCanvas.toDataURL();
      
      rotateImage(croppedDataURL, 90)
        .then(rotatedDataURL => flipImage(rotatedDataURL))
        .then(finalDataURL => {
          correctedImage.src = finalDataURL;
          fsImage.src = finalDataURL;
          transformControls.style.display = "block";
        });
      
      srcMat.delete(); dstMat.delete(); srcPts.delete(); dstPts.delete(); M.delete();
      detectedPoints = [];
      confirmPointsButton.style.display = "none";
    });
    
    /*************************************
     * FSモード：フィールド選択＆OCR処理（対象項目廃止）
     *************************************/
    let fsImage = new Image();
    const fsCanvas = document.getElementById('fsCanvas');
    const fsCtx = fsCanvas.getContext('2d');
    let fsScale = 1;
    let fsFieldRegions = {}; // 金額項目のみ自動登録
    
    const fsResetButton = document.getElementById('fsResetButton');
    const ocrWholeButton = document.getElementById('ocrWholeButton');
    const dateField = document.getElementById('dateField');
    const amountField = document.getElementById('amountField');
    const payeeField = document.getElementById('payeeField');
    const descriptionField = document.getElementById('descriptionField');
    const noteField = document.getElementById('noteField');
    
    fsImage.onload = function() {
      const maxDisplayWidth = window.innerWidth - 40;
      fsScale = (fsImage.width > maxDisplayWidth) ? (maxDisplayWidth / fsImage.width) : 1;
      fsCanvas.width = fsImage.width * fsScale;
      fsCanvas.height = fsImage.height * fsScale;
      fsFieldRegions = {};
      drawFsCanvas();
    };
    
    /*************************************
     * drawFsCanvas: FSキャンバス描画
     *************************************/
    function drawFsCanvas() {
      fsCtx.clearRect(0, 0, fsCanvas.width, fsCanvas.height);
      fsCtx.drawImage(fsImage, 0, 0, fsCanvas.width, fsCanvas.height);
      if (fsFieldRegions["amount"]) {
        fsFieldRegions["amount"].forEach(region => {
          fsCtx.strokeStyle = "red";
          fsCtx.lineWidth = 4;
          fsCtx.strokeRect(region.x, region.y, region.width, region.height);
          fsCtx.fillStyle = "rgba(255,255,255,0.7)";
          fsCtx.fillRect(region.x, region.y - 20, 60, 20);
          fsCtx.fillStyle = "red";
          fsCtx.font = "14px Arial";
          fsCtx.fillText("amount", region.x + 2, region.y - 5);
        });
      }
      if (lastGroupBoxes.length > 0) { drawGroupedBoxes(lastGroupBoxes); }
      if (currentInput && currentInput.id === "amountField") {
        // 金額項目はダイアログで処理するためハイライトは不要
      } else {
        if (selectedGroupIndex !== null && lastGroupBoxes[selectedGroupIndex]) {
          fsCtx.strokeStyle = "orange";
          fsCtx.lineWidth = 4;
          fsCtx.strokeRect(lastGroupBoxes[selectedGroupIndex].x, lastGroupBoxes[selectedGroupIndex].y,
                           lastGroupBoxes[selectedGroupIndex].width, lastGroupBoxes[selectedGroupIndex].height);
        }
      }
    }
    
    /*************************************
     * FSキャンバス上のドラッグ操作
     *************************************/
    let fsIsDrawing = false, fsStartX, fsStartY, fsCurrentX, fsCurrentY;
    fsCanvas.addEventListener('pointerdown', function(e) {
      if (currentInput) return;
      e.preventDefault();
      const rect = fsCanvas.getBoundingClientRect();
      const scaleX = fsCanvas.width / rect.width;
      const scaleY = fsCanvas.height / rect.height;
      fsStartX = (e.clientX - rect.left) * scaleX;
      fsStartY = (e.clientY - rect.top) * scaleY;
      fsIsDrawing = true;
    });
    
    fsCanvas.addEventListener('pointermove', function(e) {
      if (!fsIsDrawing) return;
      e.preventDefault();
      const rect = fsCanvas.getBoundingClientRect();
      const scaleX = fsCanvas.width / rect.width;
      const scaleY = fsCanvas.height / rect.height;
      fsCurrentX = (e.clientX - rect.left) * scaleX;
      fsCurrentY = (e.clientY - rect.top) * scaleY;
      drawFsCanvas();
      fsCtx.strokeStyle = "blue";
      fsCtx.lineWidth = 4;
      fsCtx.strokeRect(fsStartX, fsStartY, fsCurrentX - fsStartX, fsCurrentY - fsStartY);
    });
    
    fsCanvas.addEventListener('pointerup', function(e) {
      if (!fsIsDrawing) return;
      e.preventDefault();
      fsIsDrawing = false;
      const rect = fsCanvas.getBoundingClientRect();
      const scaleX = fsCanvas.width / rect.width;
      const scaleY = fsCanvas.height / rect.height;
      fsCurrentX = (e.clientX - rect.left) * scaleX;
      fsCurrentY = (e.clientY - rect.top) * scaleY;
      const x = Math.min(fsStartX, fsCurrentX);
      const y = Math.min(fsStartY, fsCurrentY);
      const width = Math.abs(fsCurrentX - fsStartX);
      const height = Math.abs(fsCurrentY - fsStartY);
      if (width === 0 || height === 0) return;
      let field = "amount";
      if (!fsFieldRegions[field]) fsFieldRegions[field] = [];
      fsFieldRegions[field].push({ x, y, width, height });
      drawFsCanvas();
    });
    
    /*************************************
     * fsResetButton: リセット
     *************************************/
    fsResetButton.addEventListener('click', function() {
      fsFieldRegions = {};
      selectedGroupIndex = null;
      groupOcrResults = {};
      lastGroupBoxes = [];
      calcSequence = [];
      document.getElementById("amountExpression").textContent = "";
      document.getElementById("amountTotalDisplay").textContent = "";
      document.getElementById("noteField").value = "";
      segmentProgress = [0, 0];
      updateCustomProgressBar();
      drawFsCanvas();
    });
    
    /*************************************
     * カスタムプログレスバー更新関数（上下オーバーレイ）
     *************************************/
    function updateCustomProgressBar() {
      // 上半分の進捗を上からの高さに、下半分の進捗を下からの高さに反映
      document.getElementById("ocrProgressTop").style.height = (segmentProgress[0] * 50) + "%";
      document.getElementById("ocrProgressBottom").style.height = (segmentProgress[1] * 50) + "%";
    }
    
    /*************************************
     * ocrWholeButton: 全体OCR実行（上下2分割＋カスタムプログレスバー）
     *************************************/
    ocrWholeButton.addEventListener('click', async function() {
      segmentProgress = [0, 0];
      updateCustomProgressBar();
      // OCR処理開始時はオーバーレイを表示
      document.getElementById("ocrProgressOverlay").style.display = "block";
      if (!fsImage.src) { console.error("fsImage.src が設定されていません。"); return; }
      let combinedData = await ocrImageInTwoSegments(fsImage);
      updateCustomProgressBar();
      lastOcrData = combinedData;
      displayGroupedText(combinedData);
      // OCR処理完了時、「下準備完了」の文字を表示
      const completeText = document.getElementById("preparationComplete");
      completeText.style.display = "block";
      // 2秒後にバーストアニメーションを実行し、オーバーレイと下準備完了テキストを消すと同時に入力項目（fieldsContainer）を表示
      setTimeout(() => {
        const overlay = document.getElementById("ocrProgressOverlay");
        overlay.classList.add("burst");
        completeText.classList.add("burst");
        overlay.addEventListener("animationend", function() {
          overlay.style.display = "none";
          // 入力項目を表示
          document.getElementById("fieldsContainer").style.display = "block";
        });
        completeText.addEventListener("animationend", function() {
          completeText.style.display = "none";
        });
      }, 2000);
    });
    
    /*************************************
     * 画像を上下に2分割して並列OCR処理する関数
     *************************************/
    async function ocrImageInTwoSegments(image) {
      // 画像の自然サイズで処理
      let canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      let ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      let halfHeight = Math.floor(canvas.height / 2);
      
      let segmentResults = await Promise.all(
        [0, 1].map(async (segIndex) => {
          let segHeight = segIndex === 0 ? halfHeight : (canvas.height - halfHeight);
          let segCanvas = document.createElement('canvas');
          segCanvas.width = canvas.width;
          segCanvas.height = segHeight;
          let segCtx = segCanvas.getContext('2d');
          segCtx.drawImage(canvas, 0, segIndex * halfHeight, canvas.width, segHeight, 0, 0, canvas.width, segHeight);
          let dataURL = segCanvas.toDataURL();
          
          const worker = Tesseract.createWorker({ 
            logger: m => {
              if(m.status==="recognizing text" && m.progress){
                segmentProgress[segIndex] = m.progress;
                updateCustomProgressBar();
              }
            }
          });
          await worker.load();
          await worker.loadLanguage('jpn');
          await worker.initialize('jpn');
          const { data } = await worker.recognize(dataURL);
          await worker.terminate();
          if (segIndex === 1) {
            data.words.forEach(word => {
              word.bbox.y0 += halfHeight;
              word.bbox.y1 += halfHeight;
            });
          }
          return data;
        })
      );
      
      let combinedWords = [];
      segmentResults.forEach(result => {
        combinedWords = combinedWords.concat(result.words);
      });
      return { words: combinedWords };
    }
    
    /*************************************
     * OCRグループ化関連関数
     *************************************/
    function completeBBox(bbox) {
      if (bbox.tl && bbox.tr && bbox.br && bbox.bl) return bbox;
      return { tl: { x: bbox.x0, y: bbox.y0 }, tr: { x: bbox.x1, y: bbox.y0 }, br: { x: bbox.x1, y: bbox.y1 }, bl: { x: bbox.x0, y: bbox.y1 } };
    }
    
    function computeAverageTilt(words) {
      let sum = 0, count = 0;
      words.forEach(word => {
        let bbox = completeBBox(word.bbox);
        let tl = bbox.tl, bl = bbox.bl;
        let dx = bl.x - tl.x, dy = bl.y - tl.y;
        if (Math.abs(dx) > 0.001) { sum += Math.atan2(dy, dx); count++; }
      });
      return count > 0 ? sum / count : 0;
    }
    
    function rotatePoint(point, angle) {
      let cos = Math.cos(angle), sin = Math.sin(angle);
      return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
    }
    
    function augmentWordsWithRotatedLeftY(words, avgAngle) {
      return words.map(word => {
        let bbox = completeBBox(word.bbox);
        let rtl = rotatePoint(bbox.tl, -avgAngle);
        let rbl = rotatePoint(bbox.bl, -avgAngle);
        let leftYMid = (rtl.y + rbl.y) / 2;
        let thresh = Math.abs(rtl.y - leftYMid);
        let leftXMid = (rtl.x + rbl.x) / 2;
        let rtr = rotatePoint(bbox.tr, -avgAngle);
        let rotatedWidth = Math.abs(rtr.x - rtl.x);
        return Object.assign({}, word, { rotatedLeftYMid: leftYMid, thresh: thresh, rotatedLeftX: leftXMid, rotatedWidth: rotatedWidth });
      });
    }
    
    function groupWordsByLineTilt(words) {
      let sorted = words.slice().sort((a, b) => a.rotatedLeftYMid - b.rotatedLeftYMid);
      let groups = [], currentGroup = [];
      sorted.forEach(word => {
        if (currentGroup.length === 0) currentGroup.push(word);
        else {
          let prev = currentGroup[currentGroup.length - 1];
          let tol = Math.min(prev.thresh, word.thresh);
          if (Math.abs(word.rotatedLeftYMid - prev.rotatedLeftYMid) < tol) currentGroup.push(word);
          else { groups.push(currentGroup); currentGroup = [word]; }
        }
      });
      if (currentGroup.length > 0) groups.push(currentGroup);
      return groups;
    }
    
    function groupWordsHorizontally(words) {
      let sorted = words.slice().sort((a, b) => a.rotatedLeftX - b.rotatedLeftX);
      let totalWidth = sorted.reduce((sum, w) => sum + w.rotatedWidth, 0);
      let avgWidth = sorted.length > 0 ? totalWidth / sorted.length : 0;
      let horizThreshold = 1.5 * avgWidth;
      let groups = [], currentGroup = [];
      sorted.forEach(word => {
        if (currentGroup.length === 0) currentGroup.push(word);
        else {
          let prev = currentGroup[currentGroup.length - 1];
          let prevRight = prev.rotatedLeftX + prev.rotatedWidth;
          let gap = word.rotatedLeftX - prevRight;
          if (gap > horizThreshold) { groups.push(currentGroup); currentGroup = [word]; }
          else currentGroup.push(word);
        }
      });
      if (currentGroup.length > 0) groups.push(currentGroup);
      return groups;
    }
    
    function displayGroupedText(data) {
      drawFsCanvas();
      let avgAngle = computeAverageTilt(data.words);
      let wordsRotated = augmentWordsWithRotatedLeftY(data.words, avgAngle);
      let verticalGroups = groupWordsByLineTilt(wordsRotated);
      let finalGroups = [];
      verticalGroups.forEach(group => {
        let horizontalGroups = groupWordsHorizontally(group);
        horizontalGroups.forEach(subgroup => finalGroups.push(subgroup));
      });
      let boxes = finalGroups.map((group, index) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        group.forEach(word => {
          let bbox = completeBBox(word.bbox);
          let rtl = rotatePoint(bbox.tl, -avgAngle);
          let rtr = rotatePoint(bbox.tr, -avgAngle);
          let rbr = rotatePoint(bbox.br, -avgAngle);
          let rbl = rotatePoint(bbox.bl, -avgAngle);
          minX = Math.min(minX, rtl.x, rtr.x, rbr.x, rbl.x);
          minY = Math.min(minY, rtl.y, rtr.y, rbr.y, rbl.y);
          maxX = Math.max(maxX, rtl.x, rtr.x, rbr.x, rbl.x);
          maxY = Math.max(maxY, rtl.y, rtr.y, rbr.y, rbl.y);
        });
        return { x: minX * fsScale, y: minY * fsScale, width: (maxX - minX) * fsScale, height: (maxY - minY) * fsScale };
      });
      lastGroupBoxes = boxes;
      drawGroupedBoxes(boxes);
    }
    
    function updateGroupedBoxes() {
      if (!lastOcrData) return;
      drawFsCanvas();
      let avgAngle = computeAverageTilt(lastOcrData.words);
      let wordsRotated = augmentWordsWithRotatedLeftY(lastOcrData.words, avgAngle);
      let verticalGroups = groupWordsByLineTilt(wordsRotated);
      let finalGroups = [];
      verticalGroups.forEach(group => {
        let horizontalGroups = groupWordsHorizontally(group);
        horizontalGroups.forEach(subgroup => finalGroups.push(subgroup));
      });
      let boxes = finalGroups.map(group => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        group.forEach(word => {
          let bbox = completeBBox(word.bbox);
          let rtl = rotatePoint(bbox.tl, -avgAngle);
          let rtr = rotatePoint(bbox.tr, -avgAngle);
          let rbr = rotatePoint(bbox.br, -avgAngle);
          let rbl = rotatePoint(bbox.bl, -avgAngle);
          minX = Math.min(minX, rtl.x, rtr.x, rbr.x, rbl.x);
          minY = Math.min(minY, rtl.y, rtr.y, rbr.y, rbl.y);
          maxX = Math.max(maxX, rtl.x, rtr.x, rbr.x, rbl.x);
          maxY = Math.max(maxY, rtl.y, rtr.y, rbr.y, rbl.y);
        });
        return { x: minX * fsScale, y: minY * fsScale, width: (maxX - minX) * fsScale, height: (maxY - minY) * fsScale };
      });
      lastGroupBoxes = boxes;
      drawGroupedBoxes(boxes);
    }
    
    function drawGroupedBoxes(boxes) {
      boxes.forEach((box, index) => {
        fsCtx.strokeStyle = "red";
        fsCtx.lineWidth = 3;
        fsCtx.strokeRect(box.x, box.y, box.width, box.height);
      });
    }
    
    /*************************************
     * performOCROnField: 高精度OCR実行
     *************************************/
    function performOCROnField(field, region) {
      return new Promise((resolve, reject) => {
        const originalX = region.x / fsScale;
        const originalY = region.y / fsScale;
        const originalWidth = region.width / fsScale;
        const originalHeight = region.height / fsScale;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalWidth;
        tempCanvas.height = originalHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(fsImage, originalX, originalY, originalWidth, originalHeight, 0, 0, originalWidth, originalHeight);
        const croppedDataURL = tempCanvas.toDataURL();
        binarizeImage(croppedDataURL).then(binarizedDataURL => {
          Tesseract.recognize(
            binarizedDataURL,
            'jpn',
            {
              langPath: 'https://tessdata.projectnaptha.com/4.0.0_best/',
              logger: m => console.log(field, m),
              tessedit_char_whitelist: '0123456789年月日-/： ',
              tessedit_pageseg_mode: 6
            }
          ).then(({ data: { text } }) => {
            resolve(replaceCircledNumbers(text.replace(/\s+/g, "")).trim());
          }).catch(err => {
            console.error(field, err);
            resolve("エラー");
          });
        }).catch(err => {
          console.error("Binarization error", err);
          resolve("エラー");
        });
      });
    }
    
    /*************************************
     * binarizeImage: 画像二値化
     *************************************/
    function binarizeImage(dataURL) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const src = cv.imread(canvas);
          const gray = new cv.Mat();
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
          const binary = new cv.Mat();
          cv.threshold(gray, binary, 128, 255, cv.THRESH_BINARY);
          cv.imshow(canvas, binary);
          const resultDataURL = canvas.toDataURL();
          src.delete(); gray.delete(); binary.delete();
          resolve(resultDataURL);
        };
        img.onerror = function(err) { reject(err); };
        img.src = dataURL;
      });
    }
    
    /*************************************
     * replaceCircledNumbers:
     * 囲み数字（丸数字）を最大50まで対応する（Unicodeのコードポイントに基づいて変換）
     *************************************/
    function replaceCircledNumbers(text) {
      return text.replace(/([\u24EA\u2460-\u2473\u3251-\u325F\u32B1-\u32BF])/g, function(match) {
        const code = match.charCodeAt(0);
        // ⓪ (U+24EA)
        if (code === 0x24EA) return "0";
        // ①～⑳ (U+2460～U+2473) → 1～20
        if (code >= 0x2460 && code <= 0x2473) return String(code - 0x245F);
        // ㉑～㉟ (U+3251～U+325F) → 21～35
        if (code >= 0x3251 && code <= 0x325F) return String(code - 0x3240);
        // ㊱～㊿ (U+32B1～U+32BF) → 36～50
        if (code >= 0x32B1 && code <= 0x32BF) return String(code - 12941);
        return match;
      });
    }
    
    /*************************************
     * processDateField: 和暦→西暦変換
     *************************************/
    function processDateField(text) {
      if (text.includes("令和") || text.includes("平成") || text.includes("昭和")) {
        return convertJapaneseEra(text);
      }
      return text;
    }
    
    /*************************************
     * processAmountField: 数字のみ抽出
     *************************************/
    function processAmountField(text) {
      return text.replace(/\D/g, "");
    }
    
    /*************************************
     * convertJapaneseEra: 和暦→西暦変換
     *************************************/
    function convertJapaneseEra(dateStr) {
      // 全角数字を半角に変換してから判定
      const normalized = dateStr.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
      const match = normalized.match(/(令和|平成|昭和)(元|\d+)[年](\d{1,2})[月](\d{1,2})[日]/);
      if (match) {
        const era = match[1];
        const yearPart = match[2];
        const month = match[3];
        const day = match[4];
        let offset = 0;
        if (era === "令和") offset = 2018;
        else if (era === "平成") offset = 1988;
        else if (era === "昭和") offset = 1925;
        const year = (yearPart === "元") ? offset + 1 : parseInt(yearPart, 10) + offset;
        return year + "年" + month + "月" + day + "日";
      }
      return dateStr;
    }
    
    /*************************************
     * 回転・反転処理
     *************************************/
    const rotate90Button = document.getElementById('rotate90Button');
    const rotateNeg90Button = document.getElementById('rotateNeg90Button');
    const flipButton = document.getElementById('flipButton');
    
    rotate90Button.addEventListener('click', function() {
      rotateImage(correctedImage.src, 90).then(newDataURL => { correctedImage.src = newDataURL; fsImage.src = newDataURL; });
    });
    
    rotateNeg90Button.addEventListener('click', function() {
      rotateImage(correctedImage.src, -90).then(newDataURL => { correctedImage.src = newDataURL; fsImage.src = newDataURL; });
    });
    
    flipButton.addEventListener('click', function() {
      flipImage(correctedImage.src).then(newDataURL => { correctedImage.src = newDataURL; fsImage.src = newDataURL; });
    });
    
    function rotateImage(dataURL, angle) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (angle % 180 !== 0) { canvas.width = img.height; canvas.height = img.width; }
          else { canvas.width = img.width; canvas.height = img.height; }
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(angle * Math.PI / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.restore();
          resolve(canvas.toDataURL());
        };
        img.onerror = reject;
        img.src = dataURL;
      });
    }
    
    function flipImage(dataURL) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.save();
          ctx.translate(img.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
          resolve(canvas.toDataURL());
        };
        img.onerror = reject;
        img.src = dataURL;
      });
    }
    
    /*************************************
     * FSキャンバス上でのグループ選択処理
     * 入力フォームが選択されている場合、金額項目なら calcDialog、その他は simpleDialog を表示
     *************************************/
    fsCanvas.addEventListener("click", function(e) {
      const rect = fsCanvas.getBoundingClientRect();
      const scaleX = fsCanvas.width / rect.width;
      const scaleY = fsCanvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;
      console.log("Canvas click:", clickX, clickY);
      let foundIndex = null;
      for (let i = 0; i < lastGroupBoxes.length; i++) {
        let box = lastGroupBoxes[i];
        if (clickX >= box.x && clickX <= box.x + box.width &&
            clickY >= box.y && clickY <= box.y + box.height) { foundIndex = i; break; }
      }
      if (foundIndex !== null) {
        if (currentInput && currentInput.id === "amountField") { 
          openCalcDialog(foundIndex); 
        } else { 
          openSimpleDialog(foundIndex); 
        }
      } else {
        console.log("クリック位置に一致するグループ枠がありません。");
        drawFsCanvas();
      }
    });
    
    /*************************************
     * correctedImage読み込み完了時にスピナーを非表示にする
     *************************************/
    correctedImage.addEventListener('load', function() {
      document.getElementById('imageSpinner').style.display = 'none';
    });
    correctedImage.addEventListener('error', function() {
      document.getElementById('imageSpinner').style.display = 'none';
    });

    // Node.js から利用できるようエクスポート
    if (typeof module !== 'undefined') {
      module.exports = {
        convertJapaneseEra,
        updateAmountCalculation,
        calcSequence
      };
    }
