// 시뮬레이션 — 가짜 popup 인터랙션
const extBadge = document.getElementById('extBadge');
const simPopup = document.getElementById('simPopup');
const simBtn = document.getElementById('simBtn');
const simFolder = document.getElementById('simFolder');
const simLog = document.getElementById('simLog');

const SIM_FILES = [
  { name: '1. 공고문(사남SS 무인보안시스템).hwp', size: '191KB', delay: 250 },
  { name: '2. 정보통신공사 적격심사기준.hwp', size: '62KB', delay: 250 },
  { name: '3. 예정공정표(사남 무인보안).pdf', size: '86KB', delay: 250 },
  { name: '4. 현장 주요 위험요인 설명자료.hwp', size: '55KB', delay: 250 },
  { name: '(안전계약특수조건 별표6)_건설공사분야 안전작업수칙.pdf', size: '44.2MB', delay: 1800 },
  { name: 'kepco 공급자 행동규범.pdf', size: '3.8MB', delay: 600 },
  { name: '한국전력공사 전자조달시스템 이용약관.hwp', size: '152KB', delay: 250 },
];

if (extBadge) {
  extBadge.addEventListener('click', () => {
    simPopup.hidden = !simPopup.hidden;
    if (!simPopup.hidden) simFolder.focus();
  });
}

function appendSimLog(msg) {
  simLog.textContent += '\n' + msg;
  simLog.scrollTop = simLog.scrollHeight;
}
function clearSimLog() {
  simLog.textContent = '';
}

function tsLabel() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

if (simBtn) {
  simBtn.addEventListener('click', async () => {
    const folder = (simFolder.value || '체험').trim() || '체험';
    simBtn.disabled = true;
    simBtn.textContent = '⏳ 시뮬 중...';
    clearSimLog();
    appendSimLog(`📁 저장: Downloads/SRM/${tsLabel()}_${folder}/`);
    appendSimLog(`📎 ${SIM_FILES.length}개 다운로드 트리거 (시뮬레이션)`);

    for (const f of SIM_FILES) {
      appendSimLog(`  • ${f.name} [${f.size}, wait ${f.delay}ms]`);
      await new Promise(r => setTimeout(r, Math.min(f.delay, 400))); // 시뮬은 최대 400ms로 빠르게
    }

    appendSimLog('\n(다운로드 완료 대기 중...)');
    await new Promise(r => setTimeout(r, 700));
    appendSimLog(`\n✓ 완료: ${SIM_FILES.length}/${SIM_FILES.length}개`);
    appendSimLog('\n💡 실제 사용 시 Downloads 폴더에서 결과를 확인하세요.');

    simBtn.disabled = false;
    simBtn.textContent = '📥 일괄 다운로드';
  });
}
