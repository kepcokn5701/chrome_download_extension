// 허용된 사이트 목록 관리.
// - 저장: chrome.storage.local.allowedSites (도메인 문자열 배열)
// - 권한: 추가 시 chrome.permissions.request로 http/https 둘 다 요청

const listEl = document.getElementById("siteList");
const emptyEl = document.getElementById("emptyMsg");
const inputEl = document.getElementById("domainInput");
const addBtn = document.getElementById("addBtn");
const statusEl = document.getElementById("status");

const DEFAULT_DOMAIN = "srm.kepco.net"; // 정적 host_permissions라 권한 회수 불가

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
  if (type === "ok") {
    setTimeout(() => {
      statusEl.className = "status";
    }, 3000);
  }
}

function clearStatus() {
  statusEl.className = "status";
}

function normalizeDomain(input) {
  let s = (input || "").trim().toLowerCase();
  if (!s) throw new Error("도메인을 입력하세요");
  s = s.replace(/^https?:\/\//, "");
  s = s.split(/[\/?#]/)[0];
  s = s.split(":")[0];
  if (
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      s,
    )
  ) {
    throw new Error("올바른 도메인 형식이 아닙니다 (예: srm.kepco.net)");
  }
  return s;
}

function originsFor(domain) {
  return [`http://${domain}/*`, `https://${domain}/*`];
}

async function getSites() {
  const { allowedSites = [] } = await chrome.storage.local.get("allowedSites");
  return allowedSites;
}

async function setSites(sites) {
  await chrome.storage.local.set({ allowedSites: sites });
}

async function render() {
  const sites = await getSites();
  listEl.innerHTML = "";

  if (sites.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  for (const domain of sites) {
    const li = document.createElement("li");
    li.className = "site-row";

    const left = document.createElement("div");
    const name = document.createElement("span");
    name.className = "site-name";
    name.textContent = domain;
    left.appendChild(name);

    if (domain === DEFAULT_DOMAIN) {
      const badge = document.createElement("span");
      badge.className = "site-meta";
      badge.textContent = "기본 등록";
      left.appendChild(badge);
    }
    li.appendChild(left);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-danger";
    removeBtn.textContent = "삭제";
    removeBtn.addEventListener("click", () => removeSite(domain));
    li.appendChild(removeBtn);

    listEl.appendChild(li);
  }
}

async function addSite() {
  clearStatus();
  let domain;
  try {
    domain = normalizeDomain(inputEl.value);
  } catch (e) {
    showStatus(e.message, "error");
    return;
  }

  const sites = await getSites();
  if (sites.includes(domain)) {
    showStatus(`${domain}는 이미 등록되어 있습니다.`, "error");
    return;
  }

  addBtn.disabled = true;
  try {
    // 기본 도메인은 정적 host_permissions로 이미 권한 보유 — request 불필요
    let granted = true;
    if (domain !== DEFAULT_DOMAIN) {
      granted = await chrome.permissions.request({
        origins: originsFor(domain),
      });
    }
    if (!granted) {
      showStatus("권한 요청이 거절되어 추가하지 않았습니다.", "error");
      return;
    }
    await setSites([...sites, domain]);
    inputEl.value = "";
    showStatus(`${domain} 추가됨.`, "ok");
    await render();
  } catch (e) {
    showStatus(`오류: ${e.message}`, "error");
  } finally {
    addBtn.disabled = false;
  }
}

async function removeSite(domain) {
  if (!confirm(`"${domain}"를 허용 목록에서 삭제할까요?`)) return;
  clearStatus();
  try {
    if (domain !== DEFAULT_DOMAIN) {
      await chrome.permissions.remove({ origins: originsFor(domain) });
    }
    const sites = await getSites();
    await setSites(sites.filter((d) => d !== domain));
    showStatus(`${domain} 삭제됨.`, "ok");
    await render();
  } catch (e) {
    showStatus(`오류: ${e.message}`, "error");
  }
}

addBtn.addEventListener("click", addSite);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});

render();
