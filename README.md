# SRM 첨부파일 일괄 다운로더 (Chrome Extension)

KEPCO 전자조달시스템(SRM)의 적격심사·PQ심사 등 첨부파일을 한 번에 다운로드하는 Chrome 확장 프로그램.

**자동화 도구가 아닌 사용자 본인 Chrome에서 직접 동작**하므로 회사 보안 정책에 부합합니다.

> ⚠ **반드시 Chrome 사용**: Edge에서는 동작하지 않습니다. 사내 정책상 SRM이 Edge에서 IE 호환 모드로 강제 로드되는데, IE 모드 안에서는 확장 프로그램이 페이지에 접근할 수 없는 구조적 한계가 있습니다. **업무망에서도 Chrome으로 SRM에 접속하세요.** Chrome이 깔려있지 않으면 사내 IT에 설치 요청.

## 🌐 사용자 가이드 페이지 (동료 배포용)

설치/사용 가이드 + 시뮬레이션 + FAQ가 있는 웹페이지:

> **Vercel URL** (배포 후 받음, 아래 "배포" 섹션 참조)

동료에게는 이 URL 하나만 공유하면 됩니다.

---

## 설치 방법 (한 번만)

1. 받은 zip 압축 해제 (예: `D:\srm_download_extension\`)
2. **Chrome** 주소창에 입력: `chrome://extensions/`
3. 우측 상단 **"개발자 모드"** 토글 ON
4. 좌측 상단 **"압축해제된 확장 프로그램을 로드합니다"** 클릭
5. 압축 해제한 폴더 선택
6. 확장 프로그램 목록에 "SRM 첨부파일 일괄 다운로더" 표시되면 성공
7. (편의) Chrome 툴바의 퍼즐 아이콘(🧩) → 이 확장 옆 핀(📌) 아이콘 클릭하여 툴바에 고정

---

## 사용 방법

1. **Chrome으로** SRM 로그인 → 메뉴 → 검색 → 공고 클릭
2. 첨부파일이 보이는 상세 페이지에서 **확장 아이콘 클릭** (툴바)
3. 폴더명(공고명 등) 입력 → **[📥 일괄 다운로드]** 클릭
4. Chrome이 모든 첨부파일을 자동으로 다운로드
5. 저장 위치: `~/Downloads/SRM/<타임스탬프>_<폴더명>/`

### 다른 사이트에서도 쓰고 싶다면 (선택)

popup 우측 상단 **⚙ 설정** 버튼 → "사이트 추가" 입력란에 도메인 입력 (예: `knai.kepco.net`) → [추가] 클릭 → 브라우저 권한 다이얼로그에서 "허용". 추가한 사이트도 동일하게 동작합니다.

기본은 `srm.kepco.net`만 등록되어 있고, 추가 사이트는 사용자가 직접 관리합니다.

### 결과물 위치 (예시)

```
C:\Users\Admin\Downloads\
└── SRM\
    └── 2026-04-28_15-30-12_무인보안시스템\
        ├── 공고문(사남SS 무인보안시스템).hwp
        ├── 정보통신공사 적격심사기준.hwp
        └── 예정공정표(사남 무인보안).pdf
```

---

## ⚠ 주의사항

- 사내 보안정책상 PDF/HWP 등은 **매일 자동 삭제**됩니다. 같은 날 안에 검토 또는 다른 위치(D 드라이브, OneDrive)로 백업하세요.
- 다운로드 위치는 Chrome 기본 Downloads 폴더 하위로만 가능합니다 (Chrome API 제약).
- 다운로드 시 Chrome이 매 파일마다 confirm 프롬프트를 띄울 수 있습니다 → "여러 파일 다운로드 허용" 한 번 클릭하면 됨
- **Edge에서는 동작하지 않습니다.** 사내 정책으로 SRM이 IE 호환 모드로 열리는 환경에서는 확장이 페이지에 접근할 수 없습니다. 업무망에서도 Chrome 사용 권장.

---

## 동작 원리

이 확장은 **사용자 액션으로 실행되는 일반적인 확장 프로그램**입니다 (Power Automate Desktop, DownThemAll!과 같은 원리).

1. 사용자가 [📥 일괄 다운로드] 버튼 클릭
2. content script가 페이지 내 첨부파일 확장자(`.pdf`, `.hwp` 등) 텍스트를 찾음
3. 각 텍스트에 더블클릭 이벤트 dispatch → SRM이 평소처럼 다운로드 트리거
4. background script가 `chrome.downloads.onDeterminingFilename`로 다운로드 위치를 지정 폴더로 redirect

자동화 도구로 분류되지 않으므로 SRM의 봇 차단 정책에 걸리지 않습니다.

---

## 문제 해결

| 증상 | 해결 |
|---|---|
| 첨부파일을 찾지 못했습니다 | 진짜 상세 페이지(첨부파일이 화면에 보이는)인지 확인 후 재시도 |
| 다운로드가 일부만 됨 | Chrome의 "여러 파일 다운로드 허용" 안내가 떴는지 확인 → "허용" 클릭 후 재시도 |
| 폴더가 만들어지지 않음 | Chrome 다운로드 설정에서 "다운로드 전 위치 묻기"가 켜져있으면 끔 |
| 확장이 동작 안 함 | `chrome://extensions/`에서 이 확장 우측의 토글이 ON인지 확인 |
| "Frame with ID 0 is not ready" 에러 | Edge 사용 중일 가능성 — 주소창에 파란 `e` 아이콘 보이면 IE 모드. **Chrome으로 변경** 필수 |
| "안전하지 않은 다운로드가 차단됨" 매번 뜸 (업무망) | `chrome://settings/content/insecureContent` → [추가] → `http://srm.kepco.net` 등록 |
| "활성 탭이 SRM 페이지가 아닙니다" 경고 | SRM 첨부파일 페이지인데도 이 경고가 뜨면 확장을 최신 버전으로 업데이트 (HTTP/HTTPS 모두 지원) |

---

## 개발자용

- 프로젝트 컨텍스트: [CLAUDE.md](CLAUDE.md)
- 변경 후 적용: `chrome://extensions/`에서 이 확장의 새로고침 아이콘(🔄) 클릭
- 사용자 가이드 페이지 소스: [docs/](docs/)

### 배포 (Vercel CLI)

GitHub이 회사망에서 차단되는 환경이라 Vercel을 쓰는 흐름. CLI는 GitHub 연결 없이 직접 deploy.

#### 첫 배포 (1회)

```bash
# 1. Vercel CLI 설치 (한 번만)
npm install -g vercel

# 2. zip 빌드 (동료가 다운로드받을 파일)
powershell -ExecutionPolicy Bypass -File build-zip.ps1

# 3. 배포 (첫 실행 시 vercel.com 로그인 + 프로젝트 생성)
vercel --prod
```

`vercel --prod`가 끝나면 배포 URL이 출력됩니다 (예: `https://chrome-download-extension.vercel.app`). 이 URL을 동료에게 공유.

#### 이후 업데이트

코드 수정 → zip 재빌드 → 재배포:

```bash
powershell -ExecutionPolicy Bypass -File build-zip.ps1
vercel --prod
```

#### 배포 설정

[vercel.json](vercel.json)의 `outputDirectory: "docs"` 설정으로 `docs/` 폴더가 사이트 root.
- `docs/index.html` — 가이드 페이지
- `docs/chrome-extension.zip` — 동료가 받을 zip ([build-zip.ps1](build-zip.ps1)이 생성)
- `docs/style.css`, `docs/script.js`
