// 활성 SRM 탭에서 첨부파일을 모두 더블클릭으로 트리거하고
// background.js의 onDeterminingFilename 핸들러가 지정 폴더로 redirect.

const ATTACHMENT_EXTENSIONS = [
  "pdf", "hwp", "hwpx", "zip",
  "doc", "docx", "xls", "xlsx",
  "ppt", "pptx", "txt", "jpg", "png",
];

const btn = document.getElementById("download");
const folderInput = document.getElementById("folder");
const log = document.getElementById("log");

function appendLog(msg) {
  log.textContent += "\n" + msg;
  log.scrollTop = log.scrollHeight;
}

function clearLog() {
  log.textContent = "";
}

function tsLabel() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function safeFolderName(name) {
  return name.replace(/[<>:"/\\|?*\n\r\t]/g, "_").trim().slice(0, 100) || "untitled";
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  clearLog();

  const folderRaw = folderInput.value.trim();
  const folderName = safeFolderName(folderRaw || "untitled");
  const folderPath = `SRM/${tsLabel()}_${folderName}`;

  appendLog(`📁 저장: Downloads/${folderPath}`);

  // background에 폴더 등록 (다운로드 시 onDeterminingFilename에서 사용)
  await chrome.runtime.sendMessage({ action: "setFolder", folder: folderPath });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith("https://srm.kepco.net/")) {
    appendLog("⚠ 활성 탭이 SRM 페이지가 아닙니다.");
    btn.disabled = false;
    return;
  }

  let result;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: triggerAttachmentDownloads,
      args: [ATTACHMENT_EXTENSIONS],
    });
    // 모든 frame의 결과 합치기
    result = (results || []).reduce(
      (acc, r) => {
        if (r && r.result) {
          acc.triggered += r.result.triggered || 0;
          acc.names.push(...(r.result.names || []));
        }
        return acc;
      },
      { triggered: 0, names: [] },
    );
  } catch (e) {
    appendLog(`❌ 실행 실패: ${e.message}`);
    btn.disabled = false;
    return;
  }

  if (result.triggered === 0) {
    appendLog("⚠ 첨부파일을 찾지 못했습니다.");
    appendLog("   상세 페이지(첨부파일이 보이는 화면)인지 확인 후 다시 시도하세요.");
    btn.disabled = false;
    return;
  }

  appendLog(`📎 ${result.triggered}개 다운로드 트리거`);
  for (const name of result.names) {
    appendLog(`  • ${name}`);
  }

  // 마지막 click 후 다운로드가 chrome.downloads에 등록될 시간 확보
  appendLog("\n(다운로드 완료 대기 중...)");
  await new Promise((r) => setTimeout(r, 2000));

  const stats = await waitDownloadsComplete(folderPath);
  appendLog(`\n✓ 완료: ${stats.completed}/${result.triggered}개`);
  if (stats.interrupted > 0) {
    appendLog(`  ⚠ 실패: ${stats.interrupted}개`);
  }
  if (stats.inProgress > 0) {
    appendLog(`  ⏳ 진행 중(타임아웃): ${stats.inProgress}개`);
  }

  btn.disabled = false;
});

async function waitDownloadsComplete(folderPath) {
  // folderPath가 OS 경로로 변환될 때 슬래시가 백슬래시로 바뀔 수 있어 둘 다 매칭
  const startedAfter = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const fwdSlash = folderPath;
  const backSlash = folderPath.replace(/\//g, "\\");

  const maxWaitMs = 90_000;       // 최대 대기 (큰 파일 고려)
  const stablePeriodMs = 3000;    // 카운트 변화 없는 시간 = 안정 상태
  const start = Date.now();

  let lastTotal = -1;
  let stableSince = Date.now();

  async function snapshot() {
    const list = await chrome.downloads.search({ startedAfter });
    const ours = list.filter(
      (d) => d.filename.includes(fwdSlash) || d.filename.includes(backSlash),
    );
    return {
      total: ours.length,
      completed: ours.filter((d) => d.state === "complete").length,
      interrupted: ours.filter((d) => d.state === "interrupted").length,
      inProgress: ours.filter((d) => d.state === "in_progress").length,
    };
  }

  while (Date.now() - start < maxWaitMs) {
    const snap = await snapshot();

    // 진행 중인 게 있으면 안정 카운터 reset
    if (snap.inProgress > 0 || snap.total !== lastTotal) {
      lastTotal = snap.total;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= stablePeriodMs) {
      // inProgress=0 이고 3초 동안 total 변화 없음 → 안정 상태, 종료
      return snap;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return await snapshot();
}

// 페이지 컨텍스트에서 실행되는 함수
// 첨부파일 텍스트를 찾고, 같은 행의 사이즈를 추출해서 동적 딜레이로 click.
async function triggerAttachmentDownloads(extensions) {
  const pattern = new RegExp("\\.(" + extensions.join("|") + ")$", "i");
  const sizePattern = /([\d,]+(?:\.\d+)?)\s*(KB|MB|GB)/i;

  function fireClick(el) {
    const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
    const seq = ["pointerdown", "mousedown", "pointerup", "mouseup"];
    for (const type of seq) {
      const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      try { el.dispatchEvent(new Ctor(type, opts)); } catch (e) {
        try { el.dispatchEvent(new MouseEvent(type, opts)); } catch (_) {}
      }
    }
    try { el.click(); } catch (_) {}
  }

  function findSizeBytes(el) {
    // 가장 가까운 행 컨테이너에서 KB/MB/GB 패턴 찾기
    const row =
      el.closest("tr") ||
      el.closest("li") ||
      el.closest("[class*='row']") ||
      el.parentElement?.parentElement;
    if (!row) return 0;
    const m = row.textContent.match(sizePattern);
    if (!m) return 0;
    const value = parseFloat(m[1].replace(/,/g, ""));
    const unit = m[2].toUpperCase();
    if (unit === "GB") return value * 1024 * 1024 * 1024;
    if (unit === "MB") return value * 1024 * 1024;
    return value * 1024;
  }

  function delayForSize(bytes) {
    const MB = 1024 * 1024;
    if (bytes < 1 * MB) return 250;
    if (bytes < 10 * MB) return 600;
    if (bytes < 50 * MB) return 1800;
    return 3500;
  }

  function fmtSize(bytes) {
    if (bytes <= 0) return "?";
    const MB = 1024 * 1024;
    if (bytes >= MB) return (bytes / MB).toFixed(1) + "MB";
    return (bytes / 1024).toFixed(0) + "KB";
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1단계: 텍스트 노드 모두 수집
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.textContent.trim();
        if (!text || !pattern.test(text)) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const items = [];
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent.trim();
    if (seen.has(text)) continue;
    seen.add(text);
    const el = node.parentElement;
    if (!el) continue;
    const sizeBytes = findSizeBytes(el);
    items.push({ el, text, sizeBytes });
  }

  // 2단계: 순차적으로 click + 사이즈 기반 딜레이
  const names = [];
  for (const { el, text, sizeBytes } of items) {
    const delay = delayForSize(sizeBytes);
    fireClick(el);
    names.push(`${text} [${fmtSize(sizeBytes)}, wait ${delay}ms]`);
    await sleep(delay);
  }

  return { triggered: items.length, names };
}
