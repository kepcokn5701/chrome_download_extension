// 사용자가 popup에서 입력한 폴더명을 받아 보관하고,
// chrome.downloads.onDeterminingFilename으로 다운로드 위치를 그 폴더로 redirect.
//
// 폴더 정보는 chrome.storage.session에 저장 (service worker가 idle돼도 유지)

const FOLDER_KEY = "currentFolder";
const FOLDER_TTL_MS = 5 * 60 * 1000; // 5분 — 그 이후엔 무효

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "setFolder") {
    chrome.storage.session.set({
      [FOLDER_KEY]: { folder: msg.folder, setAt: Date.now() },
    });
    sendResponse({ ok: true });
  }
  return true;
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  chrome.storage.session.get(FOLDER_KEY).then((data) => {
    const entry = data[FOLDER_KEY];
    if (!entry) {
      suggest({ filename: item.filename });
      return;
    }
    if (Date.now() - entry.setAt > FOLDER_TTL_MS) {
      // 너무 오래 전 설정 — 무시 (다른 다운로드가 잘못 redirect되지 않게)
      suggest({ filename: item.filename });
      return;
    }

    const baseName = item.filename.replace(/^.*[\\\/]/, "");
    const safe = baseName.replace(/[<>:"|?*]/g, "_");
    // overwrite: 같은 이름이 또 들어와도 (1)(2) 안 붙이고 덮어쓰기 → 중복 파일 방지
    suggest({ filename: `${entry.folder}/${safe}`, conflictAction: "overwrite" });
  });
  return true; // 비동기 suggest
});
