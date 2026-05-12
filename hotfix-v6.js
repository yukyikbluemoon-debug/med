(function () {
  const HOTFIX_VERSION = "2026.05.12.6";

  function markVersion() {
    document.querySelectorAll(".app-version").forEach((node) => {
      node.textContent = `เวอร์ชัน ${HOTFIX_VERSION}`;
    });
  }

  function saveMedicine(form) {
    if (!form || typeof window.saveMedicineFromForm !== "function") return;
    window.saveMedicineFromForm(form);
  }

  document.addEventListener(
    "submit",
    (event) => {
      if (event.target && event.target.id === "medicine-form") {
        event.preventDefault();
        event.stopImmediatePropagation();
        saveMedicine(event.target);
      }
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("#medicine-form .primary-button");
      if (!button || button.textContent.trim() !== "บันทึก") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      saveMedicine(button.closest("form"));
    },
    true,
  );

  const root = document.getElementById("root");
  if (root) {
    new MutationObserver(markVersion).observe(root, { childList: true, subtree: true });
  }
  markVersion();
})();
