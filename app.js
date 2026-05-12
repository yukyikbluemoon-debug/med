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
const APP_VERSION = "2026.05.12.4";
const MAX_IMAGE_BYTES = 9500;

const defaultConfig = {
  apiUrl: "",
  telegramBotToken: "",
  telegramChatId: "",
  notify: { morning: true, noon: true, evening: true, bedtime: true },
  times: Object.fromEntries(PERIODS.map((period) => [period.id, period.defaultTime])),
};

const seedMedicines = [
  {
    id: "demo-1",
    name: "ยาลดความดัน",
    dose: "1 เม็ด",
    periods: ["morning"],
    meal: "หลังอาหาร",
    note: "ดื่มน้ำตาม 1 แก้ว",
    imageUrl: "",
  },
  {
    id: "demo-2",
    name: "วิตามิน",
    dose: "ครึ่งเม็ด",
    periods: ["evening", "bedtime"],
    meal: "ไม่ระบุ",
    note: "",
    imageUrl: "",
  },
];

const state = {
  medicines: [],
  config: defaultConfig,
  activeTab: "today",
  editingMedicine: null,
  isFormOpen: false,
  status: "พร้อมใช้งาน",
};

const root = document.getElementById("root");

init();

function init() {
  const savedConfig = readJson(LOCAL_CONFIG_KEY, defaultConfig);
  const savedApiUrl = localStorage.getItem(API_URL_KEY) || "";
  state.config = mergeConfig(defaultConfig, { ...savedConfig, apiUrl: savedConfig.apiUrl || savedApiUrl });
  state.medicines = readJson(LOCAL_DATA_KEY, seedMedicines);
  render();

  if (state.config.apiUrl) {
    loadRemote(state.config.apiUrl);
  }
}

function render() {
  root.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyeline">วันนี้</p>
          <h1>ตารางยา</h1>
        </div>
        <button class="icon-button" type="button" aria-label="ตั้งค่า" data-action="open-config">${icon("settings")}</button>
      </header>

      <section class="summary-band">
        <div>
          <span>ช่วงตอนนี้</span>
          <strong>${getCurrentPeriodLabel()}</strong>
        </div>
        <button class="primary-button" type="button" data-action="add-medicine">${icon("plus")}เพิ่มยา</button>
      </section>

      <nav class="tabs" aria-label="เมนูหลัก">
        <button type="button" class="${state.activeTab === "today" ? "active" : ""}" data-tab="today">รายการยา</button>
        <button type="button" class="${state.activeTab === "config" ? "active" : ""}" data-tab="config">ตั้งค่า</button>
      </nav>

      <p class="sync-status">${escapeHtml(state.status)}</p>
      <p class="app-version">เวอร์ชัน ${APP_VERSION}</p>

      ${state.activeTab === "today" ? renderSchedule() : renderConfig()}
    </main>
    ${state.isFormOpen ? renderMedicineForm() : ""}
  `;
}

function renderSchedule() {
  return `
    <div class="schedule-list">
      ${PERIODS.map((period) => {
        const items = state.medicines.filter((medicine) => medicine.periods?.includes(period.id));
        return `
          <section class="period-section">
            <div class="period-heading">
              <h2>${period.label}</h2>
              <time>${state.config.times?.[period.id] || period.defaultTime}</time>
            </div>
            ${
              items.length
                ? items.map((medicine) => renderMedicineRow(period.id, medicine)).join("")
                : `<div class="empty-row">ยังไม่มียาสำหรับช่วงนี้</div>`
            }
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderMedicineRow(periodId, medicine) {
  return `
    <article class="medicine-row">
      ${renderMedicineImage(medicine.imageUrl, medicine.name)}
      <div class="medicine-detail">
        <h3>${escapeHtml(medicine.name)}</h3>
        <p><strong>${escapeHtml(medicine.dose)}</strong><span>${escapeHtml(medicine.meal || "ไม่ระบุ")}</span></p>
        ${medicine.note ? `<small>${escapeHtml(medicine.note)}</small>` : ""}
      </div>
      <div class="row-actions">
        <button type="button" aria-label="แก้ไข ${escapeHtml(medicine.name)}" data-action="edit-medicine" data-id="${medicine.id}">${icon("edit")}</button>
        <button type="button" aria-label="ลบ ${escapeHtml(medicine.name)}" data-action="delete-medicine" data-id="${medicine.id}">${icon("trash")}</button>
      </div>
    </article>
  `;
}

function renderConfig() {
  return `
    <section class="config-panel">
      <h2>ตั้งค่า</h2>
      <label class="field">
        <span>Google Apps Script URL</span>
        <input value="${escapeAttribute(state.config.apiUrl || "")}" data-config="apiUrl" placeholder="วาง URL ของ Web App" />
      </label>
      <label class="field">
        <span>Telegram Bot Token</span>
        <input value="${escapeAttribute(state.config.telegramBotToken || "")}" data-config="telegramBotToken" placeholder="ได้จาก BotFather" />
      </label>
      <label class="field">
        <span>Telegram Chat ID</span>
        <input value="${escapeAttribute(state.config.telegramChatId || "")}" data-config="telegramChatId" placeholder="เลข chat id ของคุณ" />
      </label>
      <div class="time-settings">
        ${PERIODS.map((period) => `
          <div class="time-row">
            <label>
              <span>${period.label}</span>
              <input type="time" value="${state.config.times?.[period.id] || period.defaultTime}" data-time="${period.id}" />
            </label>
            <label class="switch" aria-label="เปิดแจ้งเตือน ${period.label}">
              <input type="checkbox" ${state.config.notify?.[period.id] ? "checked" : ""} data-notify="${period.id}" />
              <span></span>
            </label>
          </div>
        `).join("")}
      </div>
      <div class="config-actions">
        <button type="button" class="secondary-button" data-action="reload">โหลดข้อมูล</button>
        <button type="button" class="primary-button" data-action="save-config">บันทึกตั้งค่า</button>
      </div>
    </section>
  `;
}

function renderMedicineForm() {
  const medicine = state.editingMedicine || {
    name: "",
    dose: "",
    periods: ["morning"],
    meal: "หลังอาหาร",
    note: "",
    imageUrl: "",
  };

  return `
    <div class="sheet-backdrop" role="dialog" aria-modal="true" aria-label="${state.editingMedicine ? "แก้ไขยา" : "เพิ่มยา"}">
      <form class="medicine-sheet" id="medicine-form">
        <div class="sheet-handle"></div>
        <div class="sheet-title">
          <h2>${state.editingMedicine ? "แก้ไขยา" : "เพิ่มยา"}</h2>
          <button type="button" class="icon-button" aria-label="ปิด" data-action="close-form">${icon("close")}</button>
        </div>

        <input type="hidden" name="id" value="${escapeAttribute(medicine.id || "")}" />
        <input type="hidden" name="imageUrl" value="${escapeAttribute(medicine.imageUrl || "")}" />
        <input type="hidden" name="imageFileId" value="${escapeAttribute(medicine.imageFileId || "")}" />

        <label class="field">
          <span>ชื่อยา</span>
          <input name="name" value="${escapeAttribute(medicine.name)}" placeholder="เช่น ยาลดความดัน" />
        </label>

        <label class="field">
          <span>จำนวนที่กิน</span>
          <input name="dose" value="${escapeAttribute(medicine.dose)}" placeholder="เช่น 1 เม็ด" />
        </label>

        <fieldset class="choice-group">
          <legend>ช่วงเวลา</legend>
          <div class="choice-grid">
            ${PERIODS.map((period) => `
              <label class="choice ${medicine.periods?.includes(period.id) ? "checked" : ""}">
                <input type="checkbox" name="periods" value="${period.id}" ${medicine.periods?.includes(period.id) ? "checked" : ""} />
                ${period.label}
              </label>
            `).join("")}
          </div>
        </fieldset>

        <fieldset class="choice-group">
          <legend>อาหาร</legend>
          <div class="choice-grid three">
            ${MEAL_OPTIONS.map((meal) => `
              <label class="choice ${medicine.meal === meal ? "checked" : ""}">
                <input type="radio" name="meal" value="${meal}" ${medicine.meal === meal ? "checked" : ""} />
                ${meal}
              </label>
            `).join("")}
          </div>
        </fieldset>

        <section class="photo-panel">
          <div>
            <span>รูปยา</span>
            <p>ถ่ายใหม่หรือเลือกรูปจากเครื่องได้ รูปจะถูกย่อให้อัตโนมัติ</p>
          </div>
          <div id="photo-preview">${renderMedicineImage(medicine.imageUrl, medicine.name || "ยา", true)}</div>
          <div class="photo-actions">
            <button type="button" class="secondary-button" data-action="camera">${icon("camera")}ถ่ายรูป</button>
            <button type="button" class="secondary-button" data-action="gallery">${icon("image")}เลือกรูป</button>
          </div>
          <input id="camera-input" class="hidden-input" type="file" accept="image/*" capture="environment" />
          <input id="gallery-input" class="hidden-input" type="file" accept="image/*" />
          <small class="image-status" id="image-status"></small>
        </section>

        <label class="field">
          <span>หมายเหตุ</span>
          <textarea name="note" placeholder="เช่น ดื่มน้ำตาม หรือห้ามกินคู่กับ...">${escapeHtml(medicine.note || "")}</textarea>
        </label>

        <div class="sheet-actions">
          <button type="button" class="ghost-button" data-action="close-form">ยกเลิก</button>
          <button type="submit" class="primary-button">บันทึก</button>
        </div>
      </form>
    </div>
  `;
}

root.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const tab = button.dataset.tab;

  if (tab) {
    state.activeTab = tab;
    render();
    return;
  }

  if (action === "open-config") {
    state.activeTab = "config";
    render();
  }

  if (action === "add-medicine") {
    state.editingMedicine = null;
    state.isFormOpen = true;
    render();
  }

  if (action === "edit-medicine") {
    state.editingMedicine = state.medicines.find((item) => item.id === button.dataset.id);
    state.isFormOpen = true;
    render();
  }

  if (action === "delete-medicine") {
    deleteMedicine(button.dataset.id);
  }

  if (action === "close-form") {
    state.isFormOpen = false;
    state.editingMedicine = null;
    render();
  }

  if (action === "camera") {
    document.getElementById("camera-input")?.click();
  }

  if (action === "gallery") {
    document.getElementById("gallery-input")?.click();
  }

  if (action === "reload") {
    loadRemote();
  }

  if (action === "save-config") {
    saveConfigFromInputs();
  }
});

root.addEventListener("change", (event) => {
  const input = event.target;

  if (input.matches(".choice input")) {
    input.closest(".choice").classList.toggle("checked", input.checked);
    if (input.type === "radio") {
      document.querySelectorAll(`input[name="${input.name}"]`).forEach((radio) => {
        radio.closest(".choice").classList.toggle("checked", radio.checked);
      });
    }
  }

  if (input.id === "camera-input" || input.id === "gallery-input") {
    handleImageFile(input.files?.[0]);
  }
});

root.addEventListener("submit", (event) => {
  if (event.target.id === "medicine-form") {
    event.preventDefault();
    saveMedicineFromForm(event.target);
  }
});

async function loadRemote(url = state.config.apiUrl.trim(), successMessage = "ซิงก์ข้อมูลแล้ว") {
  if (!url) return;
  setStatus("กำลังโหลดข้อมูลออนไลน์...");
  try {
    const payload = await apiRequest(url, { action: "list" });
    state.medicines = normalizeMedicines(Array.isArray(payload.medicines) ? payload.medicines : []);
    state.config = persistConfig(mergeConfig(state.config, { ...(payload.config || {}), apiUrl: url }));
    persistMedicines(state.medicines);
    setStatus(successMessage);
  } catch (error) {
    setStatus(`โหลดออนไลน์ไม่ได้ ใช้ข้อมูลในเครื่องก่อน: ${error.message}`);
  }
}

async function saveMedicineFromForm(form) {
  const formData = new FormData(form);
  const periods = formData.getAll("periods");
  const medicine = {
    id: formData.get("id") || crypto.randomUUID(),
    name: String(formData.get("name") || "").trim(),
    dose: String(formData.get("dose") || "").trim(),
    periods: periods.length ? periods : ["morning"],
    meal: formData.get("meal") || "ไม่ระบุ",
    note: String(formData.get("note") || "").trim(),
    imageUrl: formData.get("imageUrl") || "",
    imageFileId: formData.get("imageFileId") || "",
  };

  if (!medicine.name || !medicine.dose) {
    alert("กรอกชื่อยาและจำนวนที่กินก่อน");
    return;
  }

  state.medicines = upsertMedicine(state.medicines, medicine);
  state.activeTab = "today";
  persistMedicines(state.medicines);
  state.isFormOpen = false;
  state.editingMedicine = null;
  render();

  if (state.config.apiUrl) {
    setStatus(`กำลังบันทึก "${medicine.name}" ออนไลน์...`);
    try {
      if (medicine.imageUrl?.startsWith("data:image") && dataUrlBytes(medicine.imageUrl) > MAX_IMAGE_BYTES) {
        throw new Error(`รูปยังใหญ่เกินไป (${formatBytes(dataUrlBytes(medicine.imageUrl))})`);
      }
      const payload = await apiRequest(state.config.apiUrl, { action: "saveMedicine", medicine });
      const saved = payload.medicine || medicine;
      state.medicines = upsertMedicine(state.medicines, normalizeMedicine(saved));
      persistMedicines(state.medicines);
      setStatus(`บันทึก "${saved.name || medicine.name}" แล้ว`);
      await loadRemote(state.config.apiUrl, `ซิงก์แล้ว พบยา ${state.medicines.length} รายการ`);
    } catch (error) {
      setStatus(`บันทึกไว้ในเครื่องแล้ว แต่ยังซิงก์ออนไลน์ไม่ได้: ${error.message}`);
    }
  } else {
    setStatus(`บันทึก "${medicine.name}" ในเครื่องแล้ว`);
  }
}

async function deleteMedicine(id) {
  const target = state.medicines.find((item) => item.id === id);
  if (!confirm(`ลบ "${target?.name || "ยานี้"}" ใช่ไหม?`)) return;

  state.medicines = state.medicines.filter((item) => item.id !== id);
  persistMedicines(state.medicines);
  render();

  if (state.config.apiUrl) {
    try {
      await apiRequest(state.config.apiUrl, { action: "deleteMedicine", id });
      setStatus("ลบแล้ว");
    } catch (error) {
      setStatus("ลบในเครื่องแล้ว แต่ยังซิงก์ออนไลน์ไม่ได้");
    }
  }
}

async function saveConfigFromInputs() {
  const nextConfig = {
    ...state.config,
    apiUrl: document.querySelector("[data-config='apiUrl']").value.trim(),
    telegramBotToken: document.querySelector("[data-config='telegramBotToken']").value.trim(),
    telegramChatId: document.querySelector("[data-config='telegramChatId']").value.trim(),
    times: { ...state.config.times },
    notify: { ...state.config.notify },
  };

  document.querySelectorAll("[data-time]").forEach((input) => {
    nextConfig.times[input.dataset.time] = input.value;
  });
  document.querySelectorAll("[data-notify]").forEach((input) => {
    nextConfig.notify[input.dataset.notify] = input.checked;
  });

  state.config = persistConfig(nextConfig);
  localStorage.setItem(API_URL_KEY, nextConfig.apiUrl || "");

  if (nextConfig.apiUrl) {
    setStatus("กำลังบันทึกตั้งค่า...");
    try {
      await apiRequest(nextConfig.apiUrl, { action: "saveConfig", config: publicConfig(nextConfig) });
      setStatus("บันทึกตั้งค่าแล้ว");
    } catch (error) {
      setStatus("บันทึกตั้งค่าในเครื่องแล้ว แต่ยังซิงก์ออนไลน์ไม่ได้");
    }
  } else {
    setStatus("บันทึกตั้งค่าในเครื่องแล้ว");
  }
}

async function handleImageFile(file) {
  if (!file) return;
  const imageStatus = document.getElementById("image-status");
  imageStatus.textContent = "กำลังย่อรูป...";
  try {
    const imageUrl = await compressImage(file);
    document.querySelector("input[name='imageUrl']").value = imageUrl;
    document.getElementById("photo-preview").innerHTML = renderMedicineImage(imageUrl, "ยา", true);
    imageStatus.textContent = `รูปพร้อมบันทึกแล้ว (${formatBytes(dataUrlBytes(imageUrl))})`;
  } catch (error) {
    imageStatus.textContent = "ย่อรูปไม่ได้ ลองเลือกรูปใหม่";
  }
}

async function compressImage(file) {
  const dataUrl = await fileToDataUrl(file);
  const image = await loadImage(dataUrl);
  const attempts = [
    { maxSize: 360, quality: 0.48 },
    { maxSize: 280, quality: 0.42 },
    { maxSize: 220, quality: 0.36 },
    { maxSize: 180, quality: 0.32 },
    { maxSize: 140, quality: 0.28 },
    { maxSize: 110, quality: 0.24 },
  ];

  let bestDataUrl = "";
  for (const attempt of attempts) {
    const compressed = drawCompressedImage(image, attempt.maxSize, attempt.quality);
    bestDataUrl = compressed;
    if (dataUrlBytes(compressed) <= MAX_IMAGE_BYTES) {
      return compressed;
    }
  }

  return bestDataUrl;
}

function drawCompressedImage(image, maxSize, quality) {
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function apiRequest(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 160) || `HTTP ${response.status}`);
  }
  if (!payload.ok) throw new Error(payload.error || "API error");
  return payload;
}

function renderMedicineImage(src, name, large = false) {
  const className = large ? "medicine-image large" : "medicine-image";
  if (src) {
    return `<img class="${className}" src="${escapeAttribute(src)}" alt="รูป ${escapeAttribute(name)}" />`;
  }
  return `<div class="${className} placeholder" aria-label="ยังไม่มีรูป ${escapeAttribute(name)}">${icon("pill")}</div>`;
}

function icon(name) {
  const icons = {
    plus: "M12 5v14M5 12h14",
    settings:
      "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.38a1.7 1.7 0 0 0-1 .9V20a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1-.9 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.62 15a1.7 1.7 0 0 0-.9-1H3.6a2 2 0 1 1 0-4h.12a1.7 1.7 0 0 0 .9-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.62a1.7 1.7 0 0 0 1-.9V3.6a2 2 0 1 1 4 0v.12a1.7 1.7 0 0 0 1 .9 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.38 9c.16.36.46.68.9 1h.12a2 2 0 1 1 0 4h-.12a1.7 1.7 0 0 0-.9 1Z",
    edit: "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z",
    trash: "M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15",
    camera: "M4 8h3l1.5-2h7L17 8h3v11H4V8ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    image: "M4 5h16v14H4V5Zm3 11 4-4 3 3 2-2 3 3M8 9h.01",
    close: "M6 6l12 12M18 6 6 18",
    pill: "M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7ZM7 10l7 7",
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${icons[name]}"></path></svg>`;
}

function getCurrentPeriodLabel() {
  const hour = new Date().getHours();
  if (hour < 11) return "เช้า";
  if (hour < 16) return "กลางวัน";
  if (hour < 21) return "เย็น";
  return "ก่อนนอน";
}

function setStatus(status) {
  state.status = status;
  render();
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function persistMedicines(medicines) {
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(medicines));
}

function persistConfig(config) {
  localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
  return config;
}

function normalizeMedicines(medicines) {
  return medicines.map(normalizeMedicine).filter((medicine) => medicine.id && medicine.name);
}

function normalizeMedicine(medicine) {
  const periods = Array.isArray(medicine.periods)
    ? medicine.periods
    : typeof medicine.periods === "string"
      ? medicine.periods.split(",").map((period) => period.trim()).filter(Boolean)
      : ["morning"];

  return {
    ...medicine,
    id: medicine.id || crypto.randomUUID(),
    name: medicine.name || "",
    dose: medicine.dose || "",
    periods: periods.length ? periods : ["morning"],
    meal: medicine.meal || "ไม่ระบุ",
    note: medicine.note || "",
    imageUrl: medicine.imageUrl || "",
    imageFileId: medicine.imageFileId || "",
  };
}

function upsertMedicine(medicines, medicine) {
  const normalized = normalizeMedicine(medicine);
  const exists = medicines.some((item) => item.id === normalized.id);
  return exists
    ? medicines.map((item) => (item.id === normalized.id ? normalized : item))
    : [normalized, ...medicines];
}

function mergeConfig(current, next) {
  return {
    ...defaultConfig,
    ...current,
    ...next,
    times: { ...defaultConfig.times, ...current?.times, ...next?.times },
    notify: { ...defaultConfig.notify, ...current?.notify, ...next?.notify },
  };
}

function publicConfig(config) {
  const { apiUrl, ...rest } = config;
  return rest;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
