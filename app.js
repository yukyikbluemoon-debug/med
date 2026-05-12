// ============================================
// ✅ app.js - เวอร์ชันสมบูรณ์ + ปุ่มมีฟีดแบ็ก
// ============================================

// ─── 1. CONSTANTS & CONFIG ──────────────────
const PERIODS = [
  { id: "morning", label: "เช้า", defaultTime: "08:00" },
  { id: "noon", label: "กลางวัน", defaultTime: "12:00" },
  { id: "evening", label: "เย็น", defaultTime: "18:00" },
  { id: "bedtime", label: "ก่อนนอน", defaultTime: "21:30" },
];
const MEAL_OPTIONS = ["ก่อนอาหาร", "หลังอาหาร", "ไม่ระบุ"];
const API_URL_KEY = "medicine_app_api_url";
const LOCAL_DATA_KEY = "medicine_app_local_data";
const LOCAL_CONFIG_KEY = "medicine_app_local_config";
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzX4eD8anUFjbJx9lWVcLdr0hroDxTHEZhViCMeUem3Ag8tjzpKHyGybHapfYysQiq0/exec";
const APP_VERSION = "2026.05.12.6";
const MAX_IMAGE_BYTES = 300000;

const defaultConfig = {
  apiUrl: DEFAULT_API_URL,
  telegramBotToken: "",
  telegramChatId: "",
  notify: { morning: true, noon: true, evening: true, bedtime: true },
  times: Object.fromEntries(PERIODS.map((p) => [p.id, p.defaultTime])),
};

const seedMedicines = [
  { id: "demo-1", name: "ยาลดความดัน", dose: "1 เม็ด", periods: ["morning"], meal: "หลังอาหาร", note: "ดื่มน้ำตาม 1 แก้ว", imageUrl: "" },
  { id: "demo-2", name: "วิตามิน", dose: "ครึ่งเม็ด", periods: ["evening", "bedtime"], meal: "ไม่ระบุ", note: "", imageUrl: "" },
];

// ─── 2. STATE ───────────────────────────────
const state = {
  medicines: [],
  config: defaultConfig,
  activeTab: "today",
  editingMedicine: null,
  isFormOpen: false,
  status: "พร้อมใช้งาน",
};

// ─── 3. HELPER FUNCTIONS ────────────────────
function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}
function persistMedicines(medicines) {
  try {
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(medicines));
  } catch (e) {
    if (e.name === "QuotaExceededError" || e.code === 22) {
      console.warn("⚠️ localStorage เต็ม!");
      alert("⚠️ พื้นที่เก็บข้อมูลในเครื่องเต็มแล้ว กรุณาลบยาเก่าออกบ้าง");
    }
  }
}
function persistConfig(c) { localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(c)); return c; }
function escapeHtml(v = "") {  return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function escapeAttribute(v = "") { return escapeHtml(v).replaceAll("`", "&#096;"); }
function icon(name) {
  const paths = {
    plus: "M12 5v14M5 12h14",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.38a1.7 1.7 0 0 0-1 .9V20a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1-.9 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.62 15a1.7 1.7 0 0 0-.9-1H3.6a2 2 0 1 1 0-4h.12a1.7 1.7 0 0 0 .9-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.62a1.7 1.7 0 0 0 1-.9V3.6a2 2 0 1 1 4 0v.12a1.7 1.7 0 0 0 1 .9 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.38 9c.16.36.46.68.9 1h.12a2 2 0 1 1 0 4h-.12a1.7 1.7 0 0 0-.9 1Z",
    edit: "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z",
    trash: "M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15",
    camera: "M4 8h3l1.5-2h7L17 8h3v11H4V8ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    image: "M4 5h16v14H4V5Zm3 11 4-4 3 3 2-2 3 3M8 9h.01",
    close: "M6 6l12 12M18 6 6 18",
    pill: "M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7ZM7 10l7 7",
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
}
function dataUrlBytes(url) { const b64 = String(url).split(",")[1] || ""; return Math.ceil((b64.length * 3) / 4); }
function formatBytes(b) { return b < 1024 ? `${b} B` : `${Math.round(b / 1024)} KB`; }
function fileToDataUrl(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function drawCompressedImage(img, maxSize, quality) {
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
function normalizeMedicine(m) {
  const periods = Array.isArray(m.periods) ? m.periods : typeof m.periods === "string" ? m.periods.split(",").map((p) => p.trim()).filter(Boolean) : ["morning"];
  
  // ✅ แปลงลิงก์ Drive เก่า → ลิงก์ใหม่ที่แสดงใน <img> ได้
  let imageUrl = m.imageUrl || "";
  if (imageUrl.includes("drive.google.com") || imageUrl.includes("usercontent.google.com")) {
    const fileIdMatch = imageUrl.match(/[-\w]{25,}/);
    if (fileIdMatch) {
      imageUrl = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}=w800`;
    }
  }
  
  return {
    ...m,
    id: m.id || crypto.randomUUID(),
    name: m.name || "",
    dose: m.dose || "",
    periods: periods.length ? periods : ["morning"],
    meal: m.meal || "ไม่ระบุ",
    note: m.note || "",
    imageUrl: imageUrl, // ✅ ใช้ลิงก์ที่แปลงแล้ว
    imageFileId: m.imageFileId || "",
  };
}
function normalizeMedicines(arr) { return arr.map(normalizeMedicine).filter((m) => m.id && m.name); }
function upsertMedicine(list, med) { const n = normalizeMedicine(med); return list.some((x) => x.id === n.id) ? list.map((x) => x.id === n.id ? n : x) : [n, ...list]; }
function mergeConfig(cur, next) { return { ...defaultConfig, ...cur, ...next, times: { ...defaultConfig.times, ...cur?.times, ...next?.times }, notify: { ...defaultConfig.notify, ...cur?.notify, ...next?.notify } }; }
function publicConfig(c) { const { apiUrl, ...rest } = c; return rest; }
function getCurrentPeriodLabel() { const h = new Date().getHours(); if (h < 11) return "เช้า"; if (h < 16) return "กลางวัน"; if (h < 21) return "เย็น"; return "ก่อนนอน"; }

// ─── 4. CORE FUNCTIONS ──────────────────────
async function apiRequest(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
  const text = await res.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(text.slice(0, 160) || `HTTP ${res.status}`); }
  if (!payload.ok) throw new Error(payload.error || "API error");
  return payload;
}
function setStatus(s) {  state.status = s;
  setTimeout(() => { const el = document.getElementById("sync-status"); if (el) { el.textContent = escapeHtml(s); el.style.opacity = "0.7"; setTimeout(() => el.style.opacity = "1", 150); } }, 0);
}
function renderMedicineImage(src, name, large = false) {
  const cls = large ? "medicine-image large" : "medicine-image";
  if (src) return `<img class="${cls}" src="${escapeAttribute(src)}" alt="รูป ${escapeAttribute(name)}" />`;
  return `<div class="${cls} placeholder" aria-label="ยังไม่มีรูป">${icon("pill")}</div>`;
}
function renderSchedule() {
  return `<div class="schedule-list">${PERIODS.map((period) => {
    const items = state.medicines.filter((m) => m.periods?.includes(period.id));
    return `<section class="period-section"><div class="period-heading"><h2>${period.label}</h2><time>${state.config.times?.[period.id] || period.defaultTime}</time></div>${items.length ? items.map((m) => renderMedicineRow(period.id, m)).join("") : `<div class="empty-row">ยังไม่มียาสำหรับช่วงนี้</div>`}</section>`;
  }).join("")}</div>`;
}
function renderMedicineRow(periodId, medicine) {
  return `<article class="medicine-row">${renderMedicineImage(medicine.imageUrl, medicine.name)}<div class="medicine-detail"><h3>${escapeHtml(medicine.name)}</h3><p><strong>${escapeHtml(medicine.dose)}</strong><span>${escapeHtml(medicine.meal || "ไม่ระบุ")}</span></p>${medicine.note ? `<small>${escapeHtml(medicine.note)}</small>` : ""}</div><div class="row-actions"><button type="button" aria-label="แก้ไข" data-action="edit-medicine" data-id="${medicine.id}">${icon("edit")}</button><button type="button" aria-label="ลบ" data-action="delete-medicine" data-id="${medicine.id}">${icon("trash")}</button></div></article>`;
}
function renderConfig() {
  return `<section class="config-panel">
    <h2>ตั้งค่า</h2>
    <label class="field"><span>Google Apps Script URL</span><input value="${escapeAttribute(state.config.apiUrl || "")}" data-config="apiUrl" placeholder="วาง URL ของ Web App" /></label>
    <label class="field"><span>Telegram Bot Token</span><input value="${escapeAttribute(state.config.telegramBotToken || "")}" data-config="telegramBotToken" placeholder="ได้จาก BotFather" /></label>
    <label class="field"><span>Telegram Chat ID</span><input value="${escapeAttribute(state.config.telegramChatId || "")}" data-config="telegramChatId" placeholder="เลข chat id ของคุณ" /></label>
    <div class="time-settings">${PERIODS.map((p) => `<div class="time-row"><label><span>${p.label}</span><input type="time" value="${state.config.times?.[p.id] || p.defaultTime}" data-time="${p.id}" /></label><label class="switch"><input type="checkbox" ${state.config.notify?.[p.id] ? "checked" : ""} data-notify="${p.id}" /><span></span></label></div>`).join("")}</div>
    <div class="config-actions">
      <button type="button" class="secondary-button" data-action="reload">โหลดข้อมูล</button>
      <button type="button" class="secondary-button" data-action="test-telegram">📱 เทส Telegram</button>
      <button type="button" class="primary-button" data-action="save-config">บันทึกตั้งค่า</button>
    </div>
  </section>`;
}
function renderMedicineForm() {
  const m = state.editingMedicine || { name: "", dose: "", periods: ["morning"], meal: "หลังอาหาร", note: "", imageUrl: "" };
  return `<div class="sheet-backdrop" role="dialog" aria-modal="true"><form class="medicine-sheet" id="medicine-form"><div class="sheet-handle"></div><div class="sheet-title"><h2>${state.editingMedicine ? "แก้ไขยา" : "เพิ่มยา"}</h2><button type="button" class="icon-button" data-action="close-form">${icon("close")}</button></div><input type="hidden" name="id" value="${escapeAttribute(m.id || "")}" /><input type="hidden" name="imageUrl" value="${escapeAttribute(m.imageUrl || "")}" /><input type="hidden" name="imageFileId" value="${escapeAttribute(m.imageFileId || "")}" /><label class="field"><span>ชื่อยา</span><input name="name" value="${escapeAttribute(m.name)}" placeholder="เช่น ยาลดความดัน" /></label><label class="field"><span>จำนวนที่กิน</span><input name="dose" value="${escapeAttribute(m.dose)}" placeholder="เช่น 1 เม็ด" /></label><fieldset class="choice-group"><legend>ช่วงเวลา</legend><div class="choice-grid">${PERIODS.map((p) => `<label class="choice ${m.periods?.includes(p.id) ? "checked" : ""}"><input type="checkbox" name="periods" value="${p.id}" ${m.periods?.includes(p.id) ? "checked" : ""} />${p.label}</label>`).join("")}</div></fieldset><fieldset class="choice-group"><legend>อาหาร</legend><div class="choice-grid three">${MEAL_OPTIONS.map((meal) => `<label class="choice ${m.meal === meal ? "checked" : ""}"><input type="radio" name="meal" value="${meal}" ${m.meal === meal ? "checked" : ""} />${meal}</label>`).join("")}</div></fieldset><section class="photo-panel"><div><span>รูปยา</span><p>ถ่ายใหม่หรือเลือกรูปจากเครื่องได้ รูปจะถูกย่อให้อัตโนมัติ</p></div><div id="photo-preview">${renderMedicineImage(m.imageUrl, m.name || "ยา", true)}</div><div class="photo-actions"><button type="button" class="secondary-button" data-action="camera">${icon("camera")}ถ่ายรูป</button><button type="button" class="secondary-button" data-action="gallery">${icon("image")}เลือกรูป</button></div><input id="camera-input" class="hidden-input" type="file" accept="image/*" capture="environment" /><input id="gallery-input" class="hidden-input" type="file" accept="image/*" /><small class="image-status" id="image-status"></small></section><label class="field"><span>หมายเหตุ</span><textarea name="note" placeholder="เช่น ดื่มน้ำตาม">${escapeHtml(m.note || "")}</textarea></label><div class="sheet-actions"><button type="button" class="ghost-button" data-action="close-form">ยกเลิก</button><button type="button" class="primary-button" data-action="save-medicine">บันทึก</button></div></form></div>`;
}
function buildAppHTML() {
  return `<main class="app-shell"><header class="topbar"><div><p class="eyeline">วันนี้</p><h1>ตารางยา</h1></div><button class="icon-button" type="button" aria-label="ตั้งค่า" data-action="open-config">${icon("settings")}</button></header><section class="summary-band"><div><span>ช่วงตอนนี้</span><strong>${getCurrentPeriodLabel()}</strong></div><button class="primary-button" type="button" data-action="add-medicine">${icon("plus")}เพิ่มยา</button></section><nav class="tabs" aria-label="เมนูหลัก"><button type="button" class="${state.activeTab === "today" ? "active" : ""}" data-tab="today">รายการยา</button><button type="button" class="${state.activeTab === "config" ? "active" : ""}" data-tab="config">ตั้งค่า</button></nav><p class="sync-status" id="sync-status">${escapeHtml(state.status)}</p><p class="app-version">เวอร์ชัน ${APP_VERSION}</p>${state.activeTab === "today" ? renderSchedule() : renderConfig()}</main>${state.isFormOpen ? renderMedicineForm() : ""}`;
}

// ─── 5. RENDER & DEBOUNCE ───────────────────
let renderTimer = null;
const root = document.getElementById("root");
function render() {
  if (!root) return;
  if (renderTimer) cancelAnimationFrame(renderTimer);
  renderTimer = requestAnimationFrame(() => { root.innerHTML = buildAppHTML(); });
}

// ─── 6. INIT ────────────────────────────────
function init() {  if (!root) { console.error("❌ ไม่พบ #root"); return; }
  const savedConfig = readJson(LOCAL_CONFIG_KEY, defaultConfig);
  const savedApiUrl = localStorage.getItem(API_URL_KEY) || "";
  state.config = mergeConfig(defaultConfig, { ...savedConfig, apiUrl: savedConfig.apiUrl || savedApiUrl || DEFAULT_API_URL });
  state.medicines = readJson(LOCAL_DATA_KEY, seedMedicines);
  render();
  if (state.config.apiUrl) setTimeout(() => loadRemote(state.config.apiUrl), 100);
}
document.addEventListener("DOMContentLoaded", init);

// ─── 7. EVENT LISTENERS ─────────────────────
root?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  const action = btn.dataset.action, tab = btn.dataset.tab;
  
  // ✅ ฟีดแบ็กปุ่ม: แสดงว่า "กำลัง..." ชั่วคราว
  if (["reload", "test-telegram", "save-config"].includes(action)) {
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.dataset.original = originalText;
    btn.innerHTML = `⏳ กำลัง...`;
    setTimeout(() => { btn.disabled = false; btn.innerHTML = btn.dataset.original || originalText; }, 2000);
  }
  
  if (tab) { state.activeTab = tab; render(); return; }
  if (action === "open-config") { state.activeTab = "config"; render(); }
  if (action === "add-medicine") { state.editingMedicine = null; state.isFormOpen = true; render(); }
  if (action === "edit-medicine") { state.editingMedicine = state.medicines.find((x) => x.id === btn.dataset.id); state.isFormOpen = true; render(); }
  if (action === "delete-medicine") deleteMedicine(btn.dataset.id);
  if (action === "close-form") { state.isFormOpen = false; state.editingMedicine = null; render(); }
  if (action === "camera") document.getElementById("camera-input")?.click();
  if (action === "gallery") document.getElementById("gallery-input")?.click();
  if (action === "reload") loadRemote();
  if (action === "save-config") saveConfigFromInputs();
  if (action === "test-telegram") {
    if (typeof testTelegramNotification === "function") testTelegramNotification();
    else alert("❌ ฟังก์ชันเทสยังไม่โหลดสำเร็จ กรุณารีเฟรช (Ctrl+Shift+R)");
  }
  if (action === "save-medicine") { const f = btn.closest("form"); if (f) saveMedicineFromForm(f); }
});

root?.addEventListener("change", (e) => {
  const input = e.target;
  if (input.matches(".choice input")) {
    input.closest(".choice").classList.toggle("checked", input.checked);
    if (input.type === "radio") document.querySelectorAll(`input[name="${input.name}"]`).forEach((r) => r.closest(".choice").classList.toggle("checked", r.checked));
  }
  if (input.id === "camera-input" || input.id === "gallery-input") handleImageFile(input.files?.[0]);
});
root?.addEventListener("submit", (e) => {
  if (e.target?.id === "medicine-form") { e.preventDefault(); saveMedicineFromForm(e.target); }
}, true);

// ─── 8. BUSINESS LOGIC ──────────────────────
async function loadRemote(url = state.config.apiUrl?.trim(), successMsg = "ซิงก์ข้อมูลแล้ว") {
  if (!url) return;
  setStatus("กำลังโหลดข้อมูลออนไลน์...");
  try {
    const payload = await apiRequest(url, { action: "list" });
    state.medicines = normalizeMedicines(Array.isArray(payload.medicines) ? payload.medicines : []);
    state.config = persistConfig(mergeConfig(state.config, { ...(payload.config || {}), apiUrl: url }));
    persistMedicines(state.medicines);
    setStatus(successMsg);
  } catch (err) { setStatus(`โหลดออนไลน์ไม่ได้: ${err.message}`); }
}

async function saveMedicineFromForm(form) {
  const fd = new FormData(form);
  const medicine = {
    id: fd.get("id") || crypto.randomUUID(),
    name: String(fd.get("name") || "").trim(),
    dose: String(fd.get("dose") || "").trim(),
    periods: fd.getAll("periods").length ? fd.getAll("periods") : ["morning"],
    meal: fd.get("meal") || "ไม่ระบุ",
    note: String(fd.get("note") || "").trim(),
    imageUrl: fd.get("imageUrl") || "",
    imageFileId: fd.get("imageFileId") || "",
  };
  if (!medicine.name || !medicine.dose) { alert("กรอกชื่อยาและจำนวนที่กินก่อน"); return; }
  state.medicines = upsertMedicine(state.medicines, medicine);
  state.activeTab = "today";
  persistMedicines(state.medicines);
  state.isFormOpen = false;
  state.editingMedicine = null;
  render();
  if (state.config.apiUrl) {
    setStatus(`กำลังบันทึก "${medicine.name}" ออนไลน์...`);
    setTimeout(async () => {
      try {
        if (medicine.imageUrl?.startsWith("data:image") && dataUrlBytes(medicine.imageUrl) > MAX_IMAGE_BYTES) throw new Error("รูปใหญ่เกิน");
        const payload = await apiRequest(state.config.apiUrl, { action: "saveMedicine", medicine });
        const saved = payload.medicine || medicine;
        state.medicines = upsertMedicine(state.medicines, normalizeMedicine(saved));
        persistMedicines(state.medicines);
        setStatus(`บันทึก "${saved.name || medicine.name}" แล้ว`);
        await loadRemote(state.config.apiUrl, `ซิงก์แล้ว พบยา ${state.medicines.length} รายการ`);
      } catch (err) { setStatus(`บันทึกในเครื่องแล้ว แต่ซิงก์ออนไลน์ไม่ได้: ${err.message}`); }
    }, 50);
  } else setStatus(`บันทึก "${medicine.name}" ในเครื่องแล้ว`);}

async function deleteMedicine(id) {
  const target = state.medicines.find((x) => x.id === id);
  if (!confirm(`ลบ "${target?.name || "ยานี้"}" ใช่ไหม?`)) return;
  state.medicines = state.medicines.filter((x) => x.id !== id);
  persistMedicines(state.medicines);
  render();
  if (state.config.apiUrl) {
    try { await apiRequest(state.config.apiUrl, { action: "deleteMedicine", id }); setStatus("ลบแล้ว"); }
    catch { setStatus("ลบในเครื่องแล้ว แต่ซิงก์ออนไลน์ไม่ได้"); }
  }
}

async function saveConfigFromInputs() {
  const next = { ...state.config, apiUrl: document.querySelector("[data-config='apiUrl']")?.value.trim(), telegramBotToken: document.querySelector("[data-config='telegramBotToken']")?.value.trim(), telegramChatId: document.querySelector("[data-config='telegramChatId']")?.value.trim(), times: { ...state.config.times }, notify: { ...state.config.notify } };
  document.querySelectorAll("[data-time]").forEach((el) => { next.times[el.dataset.time] = el.value; });
  document.querySelectorAll("[data-notify]").forEach((el) => { next.notify[el.dataset.notify] = el.checked; });
  state.config = persistConfig(next);
  localStorage.setItem(API_URL_KEY, next.apiUrl || "");
  if (next.apiUrl) {
    setStatus("กำลังบันทึกตั้งค่า...");
    try { await apiRequest(next.apiUrl, { action: "saveConfig", config: publicConfig(next) }); setStatus("บันทึกตั้งค่าแล้ว"); }
    catch { setStatus("บันทึกตั้งค่าในเครื่องแล้ว แต่ซิงก์ออนไลน์ไม่ได้"); }
  } else setStatus("บันทึกตั้งค่าในเครื่องแล้ว");
}

async function handleImageFile(file) {
  if (!file) return;
  const statusEl = document.getElementById("image-status");
  statusEl.textContent = "กำลังย่อรูป...";
  try {
    const imageUrl = await compressImage(file);
    document.querySelector("input[name='imageUrl']").value = imageUrl;
    document.getElementById("photo-preview").innerHTML = renderMedicineImage(imageUrl, "ยา", true);
    statusEl.textContent = `รูปพร้อมแล้ว (${formatBytes(dataUrlBytes(imageUrl))})`;
  } catch { statusEl.textContent = "ย่อรูปไม่ได้ ลองใหม่"; }
}

async function compressImage(file) {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);
  const attempts = [{ maxSize: 280, quality: 0.45 }, { maxSize: 220, quality: 0.38 }, { maxSize: 180, quality: 0.32 }];
  for (const a of attempts) {
    const compressed = drawCompressedImage(img, a.maxSize, a.quality);
    if (dataUrlBytes(compressed) <= MAX_IMAGE_BYTES) return compressed;
  }
  return drawCompressedImage(img, 140, 0.28);
}
// ─── 9. TELEGRAM TEST FUNCTION (ท้ายสุดของไฟล์) ──
async function testTelegramNotification() {
  const token = document.querySelector('[data-config="telegramBotToken"]')?.value?.trim();
  const chatId = document.querySelector('[data-config="telegramChatId"]')?.value?.trim();

  if (!token || !chatId) {
    alert("กรุณากรอก Telegram Bot Token และ Chat ID ก่อนกดทดสอบ");
    return;
  }

  setStatus("📤 กำลังส่งข้อความทดสอบ...");
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ <b>ทดสอบระบบแจ้งเตือนยา</b>\n🕒 ${new Date().toLocaleString('th-TH')}\n\nเชื่อมต่อสำเร็จ! 🎉`,
        parse_mode: "HTML"
      })
    });
    const data = await res.json();
    if (data.ok) {
      setStatus("✅ ส่งข้อความทดสอบไปยัง Telegram สำเร็จ!");
    } else {
      throw new Error(data.description || "Telegram ปฏิเสธคำขอ");
    }
  } catch (err) {
    setStatus(`❌ ส่งไม่สำเร็จ: ${err.message}`);
  }
}
