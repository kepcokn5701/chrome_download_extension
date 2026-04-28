# SRM Download Extension — 프로젝트 헌법

> 매 대화 시작 시 자동 로드. 프로젝트 맥락·규칙·디자인 철학을 여기서 복원.

---

## 1. 목적

KEPCO SRM 첨부파일을 한 번에 다운로드하는 **Chrome Extension** (Manifest V3).

## 2. 디자인 철학 — 왜 Extension인가

**자동화 도구가 아니라 사용자 본인 Chrome 안에서 사용자 액션으로 동작**하기 때문에 회사 보안 정책에 부합합니다.

이전 프로젝트 (`srm_download_automation` Python+Playwright .exe)는 본질적으로 자동화 도구라 SRM이 봇 차단 정책으로 막았습니다. 우회 시도는 모두 회사 보안 정책 위반이라 폐기했습니다.

Extension은 Power Automate Desktop, DownThemAll!과 같은 원리 — 사용자 명시 액션으로 페이지의 다운로드 메커니즘을 연쇄 트리거.

---

## 3. 사용자 흐름

```
[설치 1회]
  chrome://extensions/ → 개발자 모드 ON → 압축해제된 확장 로드 → 폴더 선택

[매번]
  1. 평소처럼 SRM 로그인 → 메뉴 → 검색 → 공고 클릭
  2. 첨부파일 페이지에서 확장 아이콘 클릭
  3. 폴더명 입력 → [📥 일괄 다운로드]
  4. ~/Downloads/SRM/<타임스탬프>_<폴더명>/ 에 저장
```

---

## 4. 동작 메커니즘

1. **popup.js**: 사용자 입력(폴더명) 받음 → background에 폴더 등록 → `chrome.scripting.executeScript`로 활성 탭에 함수 주입
2. **주입된 함수 (페이지 컨텍스트)**: TreeWalker로 페이지 내 모든 텍스트 노드 순회 → 첨부파일 확장자(`.pdf`/`.hwp`/...) 매칭 → 부모 element에 dblclick 이벤트 dispatch
3. **SRM 페이지의 자체 onclick handler**: 더블클릭 받아 평소처럼 다운로드 트리거 (POST 또는 link click)
4. **background.js (`chrome.downloads.onDeterminingFilename`)**: 다운로드 발생 시 등록된 폴더(`SRM/<타임스탬프>_<폴더명>/`)로 filename redirect

---

## 5. 디렉토리 구조

```
srm_download_extension/
├── manifest.json          ← Manifest V3
├── popup.html             ← 폴더명 입력 + 버튼 UI
├── popup.js               ← 사용자 액션 처리, 페이지에 함수 주입
├── background.js          ← service worker, downloads.onDeterminingFilename
├── icons/                 ← (선택) 아이콘 파일
├── README.md              ← 사용자(동료) 설치/사용 가이드
└── CLAUDE.md              ← 이 파일
```

---

## 6. 주요 API

| API | 용도 |
|---|---|
| `chrome.scripting.executeScript` | 활성 탭에 함수 주입 (content script 대신) |
| `chrome.downloads.onDeterminingFilename` | 다운로드 시작 직전 filename 결정 → 폴더 redirect |
| `chrome.storage.session` | popup→background 간 폴더명 전달 (service worker idle 안전) |
| MouseEvent (dblclick) | 페이지 내 첨부파일 텍스트 element에 dispatch |

---

## 7. Manifest V3 권한

```json
"permissions": ["downloads", "scripting", "activeTab", "storage"],
"host_permissions": ["https://srm.kepco.net/*"]
```

- `downloads` — onDeterminingFilename, 다운로드 추적
- `scripting` — 활성 탭에 함수 주입
- `activeTab` — 사용자 클릭 시점에만 탭 접근 (안전)
- `storage` — popup→background 폴더명 전달
- `host_permissions: srm.kepco.net` — content script 주입 대상 제한

---

## 8. 알려진 한계

- 다운로드 위치는 **Chrome 기본 Downloads 폴더 하위**로만 가능 (Chrome API 제약). D 드라이브 등 절대 경로 X.
- 다운로드 PDF/HWP는 사내 보안정책상 매일 삭제. 사용자가 백업 책임.
- "여러 파일 다운로드 허용" 안내가 한 번 뜸 → 사용자가 허용 클릭
- SRM이 더블클릭이 아닌 다른 트리거 방식으로 변경 시 동작 안 함 → JS 패턴 수정 필요

---

## 9. Claude 작업 규칙

1. **자동화 도구로 회귀 금지**: 이전 .exe 프로젝트가 실패한 이유 (보안 우회 = 정책 위반). Extension 디자인 유지.
2. **새 기능 추가 시 권한 최소화**: `tabs`, `webRequest` 등 강력한 권한 요구하지 않음. `activeTab`으로 충분.
3. **content script 주입은 사용자 액션 시점에만**: declarative content script 추가 X (모든 페이지 자동 주입 X).
4. **다른 사이트로 확장 시**: `host_permissions`에 도메인 추가만. JS 코드는 일반화돼있어 변경 거의 없음.
5. **변경 후 적용**: `chrome://extensions/`에서 새로고침 아이콘 클릭.

---

## 10. 동료 배포

zip 파일 + README.md 같이 전달. 동료는:
1. 압축 해제
2. `chrome://extensions/` → 개발자 모드 ON → "압축해제된 확장 로드" → 폴더 선택
3. 끝

회사 정책상 외부 extension 설치가 막혀있으면 IT 관리자에게 화이트리스트 등록 요청.

---

## 11. 이전 프로젝트와의 관계

- `srm_download_automation` (Python+Playwright .exe): **폐기 결정**. 보안 우회 본질적 한계.
- `srm_download_extension` (이 프로젝트): 새 시작. 보안 정책 부합.
- 두 프로젝트는 별개 GitHub repo로 관리 권장 (또는 동일 repo의 별개 폴더).
