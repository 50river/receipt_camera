const assert = require('assert');

// convertJapaneseEra のテスト対象関数
function convertJapaneseEra(dateStr) {
  const normalized = dateStr.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  const match = normalized.match(/(令和|平成|昭和)(元|\d+)[年](\d{1,2})[月](\d{1,2})[日]/);
  if (match) {
    const era = match[1];
    const yearPart = match[2];
    const month = match[3];
    const day = match[4];
    let offset = 0;
    if (era === '令和') offset = 2018;
    else if (era === '平成') offset = 1988;
    else if (era === '昭和') offset = 1925;
    const year = (yearPart === '元') ? offset + 1 : parseInt(yearPart, 10) + offset;
    return year + '年' + month + '月' + day + '日';
  }
  return dateStr;
}

// updateAmountCalculation の簡易版
function updateAmountCalculation(seq) {
  if (seq.length === 0) return { expression: '', total: 0 };
  let total = parseInt(seq[0].value, 10) || 0;
  let expression = seq[0].value;
  for (let i = 1; i < seq.length; i += 2) {
    const opObj = seq[i];
    const numObj = seq[i + 1];
    if (!opObj || !numObj) break;
    const num = parseInt(numObj.value, 10) || 0;
    if (opObj.operator === '+') {
      total += num;
      expression += ' + ' + num;
    } else if (opObj.operator === '-') {
      total -= num;
      expression += ' - ' + num;
    }
  }
  return { expression, total };
}

// テスト実行
(function() {
  assert.strictEqual(convertJapaneseEra('令和２年3月5日'), '2020年3月5日');

  const seq = [
    { value: '100' },
    { operator: '+' },
    { value: '50' },
    { operator: '-' },
    { value: '30' }
  ];
  const result = updateAmountCalculation(seq);
  assert.strictEqual(result.total, 120);
  assert.strictEqual(result.expression, '100 + 50 - 30');

  console.log('All tests passed');
})();
