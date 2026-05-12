// ✅ hotfix-v6.js - เวอร์ชันแก้ค้าง
(function () {
  const HOTFIX_VERSION = "2026.05.12.6";
  let versionMarked = false;

  function markVersion() {
    if (versionMarked) return; // ✅ กันเรียกซ้ำ
    document.querySelectorAll(".app-version").forEach((node) => {
      if (!node.textContent.includes(HOTFIX_VERSION)) {
        node.textContent = `เวอร์ชัน ${HOTFIX_VERSION}`;
      }
    });
    versionMarked = true;
  }

  // ✅ เรียกครั้งเดียวหลังโหลดหน้า แทนที่จะใช้ MutationObserver
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markVersion, { once: true });
  } else {
    markVersion();
  }

  // ✅ ลบ event listener ที่ขัดแย้งออกทั้งหมด
  // (ให้ app.js จัดการฟอร์มเองอย่างเดียว)

})();
