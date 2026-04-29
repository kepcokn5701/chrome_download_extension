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
const settingsBtn = document.getElementById("settings");
const openFolderBtn = document.getElementById("open-folder");

settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// 가장 최근 SRM/<타임스탬프>_<폴더명>/ 다운로드를 찾아 그 위치로 탐색기 열기.
// 없으면 기본 Downloads 폴더로 폴백.
openFolderBtn.addEventListener("click", async () => {
  try {
    const list = await chrome.downloads.search({
      orderBy: ["-startTime"],
      limit: 50,
    });
    const srm = list.find(
      (d) =>
        d.filename &&
        (d.filename.includes("/SRM/") || d.filename.includes("\\SRM\\")) &&
        d.state !== "interrupted",
    );
    if (srm) {
      chrome.downloads.show(srm.id);
      return;
    }
  } catch {
    // fall through to default folder
  }
  chrome.downloads.showDefaultFolder();
});

async function getAllowedSites() {
  const { allowedSites = [] } = await chrome.storage.local.get("allowedSites");
  return allowedSites;
}

function isHostAllowed(hostname, allowedSites) {
  const h = hostname.toLowerCase();
  return allowedSites.some((d) => h === d.toLowerCase());
}

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
  if (!tab || !tab.url) {
    appendLog("⚠ 활성 탭을 찾을 수 없습니다.");
    btn.disabled = false;
    return;
  }
  let url;
  try {
    url = new URL(tab.url);
  } catch {
    appendLog("⚠ 활성 탭이 일반 웹페이지가 아닙니다.");
    btn.disabled = false;
    return;
  }
  if (!/^https?:$/.test(url.protocol)) {
    appendLog("⚠ http/https 페이지에서만 동작합니다.");
    btn.disabled = false;
    return;
  }
  const allowedSites = await getAllowedSites();
  if (!isHostAllowed(url.hostname, allowedSites)) {
    appendLog(`⚠ "${url.hostname}"는 허용 목록에 없습니다.`);
    appendLog("   우측 상단 ⚙ 설정에서 사이트를 추가하세요.");
    btn.disabled = false;
    return;
  }

  // 1차 시도: 모든 첨부파일 클릭
  let firstResult;
  try {
    firstResult = combineResults(await injectWithFallback(tab.id, null));
  } catch (e) {
    appendLog(`❌ 실행 실패: ${e.message}`);
    appendLog(`   페이지가 완전히 로드된 후 다시 시도하세요.`);
    btn.disabled = false;
    return;
  }

  if (firstResult.triggered === 0) {
    appendLog("⚠ 첨부파일을 찾지 못했습니다.");
    appendLog("   상세 페이지(첨부파일이 보이는 화면)인지 확인 후 다시 시도하세요.");
    btn.disabled = false;
    return;
  }

  appendLog(`📎 ${firstResult.triggered}개 다운로드 트리거`);
  for (const name of firstResult.displayNames) {
    appendLog(`  • ${name}`);
  }

  const expectedTexts = firstResult.clickedTexts;
  const MAX_PASSES = 3; // 1차 + 재시도 2회
  let missingTexts = [];

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    appendLog(
      pass === 1
        ? "\n(다운로드 완료 대기 중...)"
        : `\n(재시도 ${pass - 1}회 — 다운로드 완료 대기 중...)`,
    );
    await new Promise((r) => setTimeout(r, 2000));
    await waitDownloadsComplete(folderPath);

    const downloaded = await getDownloadedBaseNames(folderPath);
    const dlSet = new Set(downloaded);
    missingTexts = expectedTexts.filter((t) => !dlSet.has(t));

    if (missingTexts.length === 0) {
      appendLog(`\n✓ 완료: ${expectedTexts.length}/${expectedTexts.length}개`);
      btn.disabled = false;
      return;
    }

    if (pass >= MAX_PASSES) break;

    appendLog(`\n⚠ ${missingTexts.length}개 누락 — 재시도 ${pass}회`);
    for (const t of missingTexts) appendLog(`  • ${t}`);

    try {
      await injectWithFallback(tab.id, missingTexts);
    } catch (e) {
      appendLog(`❌ 재시도 실패: ${e.message}`);
      break;
    }
  }

  // 모든 패스 끝나도 누락 남음
  const completed = expectedTexts.length - missingTexts.length;
  appendLog(`\n△ 완료: ${completed}/${expectedTexts.length}개 (재시도 ${MAX_PASSES - 1}회 후에도 일부 누락)`);
  appendLog(`누락 ${missingTexts.length}개 (수동 클릭 필요):`);
  for (const t of missingTexts) appendLog(`  • ${t}`);

  btn.disabled = false;
});

function combineResults(results) {
  return (results || []).reduce(
    (acc, r) => {
      if (r && r.result) {
        acc.triggered += r.result.triggered || 0;
        acc.displayNames.push(...(r.result.displayNames || []));
        acc.clickedTexts.push(...(r.result.clickedTexts || []));
      }
      return acc;
    },
    { triggered: 0, displayNames: [], clickedTexts: [] },
  );
}

async function getDownloadedBaseNames(folderPath) {
  const startedAfter = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const fwdSlash = folderPath;
  const backSlash = folderPath.replace(/\//g, "\\");
  const list = await chrome.downloads.search({ startedAfter });
  const ours = list.filter(
    (d) =>
      (d.filename.includes(fwdSlash) || d.filename.includes(backSlash)) &&
      d.state === "complete",
  );
  // base filename만 추출, 중복 제거
  return [...new Set(ours.map((d) => d.filename.replace(/^.*[\\\/]/, "")))];
}

// allFrames=true는 한 프레임이라도 not-ready면 전체 reject.
// SRM이 탭/패널마다 iframe을 쓰는 구조라 숨김 프레임이 transitional이면 자주 터짐.
// → 재시도 후 폴백으로 메인 프레임만 주입.
// targetTextsFilter가 주어지면 그 텍스트와 정확히 일치하는 첨부파일만 클릭 (재시도용).
async function injectWithFallback(tabId, targetTextsFilter) {
  const baseOpts = {
    func: triggerAttachmentDownloads,
    args: [ATTACHMENT_EXTENSIONS, targetTextsFilter],
  };

  try {
    return await chrome.scripting.executeScript({
      ...baseOpts,
      target: { tabId, allFrames: true },
    });
  } catch (e) {
    if (!isFrameNotReady(e)) throw e;
    appendLog("(일부 프레임 not-ready, 잠시 후 재시도)");
  }

  await new Promise((r) => setTimeout(r, 800));

  try {
    return await chrome.scripting.executeScript({
      ...baseOpts,
      target: { tabId, allFrames: true },
    });
  } catch (e) {
    if (!isFrameNotReady(e)) throw e;
    appendLog("(여전히 not-ready, 메인 프레임만 시도)");
  }

  return await chrome.scripting.executeScript({
    ...baseOpts,
    target: { tabId },
  });
}

function isFrameNotReady(e) {
  return /frame.*not ready|not ready.*frame/i.test(String(e?.message || e));
}

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
// targetTextsFilter가 배열이면 해당 텍스트만 (정확 일치) 클릭 — 재시도 호출용.
async function triggerAttachmentDownloads(extensions, targetTextsFilter) {
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
    if (bytes < 1 * MB) return 600;
    if (bytes < 10 * MB) return 1200;
    if (bytes < 50 * MB) return 2500;
    return 5000;
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

  // 2단계: 필터 적용 (재시도 호출 시 누락된 것만)
  let toClick = items;
  if (Array.isArray(targetTextsFilter) && targetTextsFilter.length > 0) {
    const want = new Set(targetTextsFilter);
    toClick = items.filter((it) => want.has(it.text));
  }

  // 3단계: 순차적으로 click + 사이즈 기반 딜레이
  const displayNames = [];
  const clickedTexts = [];
  for (const { el, text, sizeBytes } of toClick) {
    const delay = delayForSize(sizeBytes);
    fireClick(el);
    displayNames.push(`${text} [${fmtSize(sizeBytes)}, wait ${delay}ms]`);
    clickedTexts.push(text);
    await sleep(delay);
  }

  return { triggered: toClick.length, displayNames, clickedTexts };
}
