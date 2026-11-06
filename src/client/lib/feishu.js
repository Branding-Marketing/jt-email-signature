// Feishu auto-fill helpers and the fields remembered in this browser.
export const FEISHU_ERRORS = {
  denied: "Feishu sign-in was cancelled.",
  invalid_state: "Feishu sign-in expired. Please try again.",
  error: "Feishu sign-in failed. You can still fill in your details manually.",
};

// Re-draws the Feishu avatar as a 400×400 circular PNG, matching what the cropper produces,
// so Outlook (which ignores border-radius) still shows a round photo.
export function toCircularPng(src, size = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Prefer the Feishu nickname (usually the English name), then the English name, then the display name.
export const profileName = (p) => (p.nickname || p.enName || p.name || "").trim();

// Fields Feishu cannot provide are remembered in this browser so staff only type them once.
const SAVED_FIELDS_KEY = "jt-sig-saved-fields";
export const SAVED_FIELDS = ["title", "mobile", "email", "linkedin"];

export function loadSavedFields() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_FIELDS_KEY) || "{}");
    return Object.fromEntries(SAVED_FIELDS.map((k) => [k, typeof saved[k] === "string" ? saved[k] : ""]));
  } catch {
    return {};
  }
}

export function storeSavedFields(form) {
  try {
    localStorage.setItem(SAVED_FIELDS_KEY, JSON.stringify(Object.fromEntries(SAVED_FIELDS.map((k) => [k, form[k] || ""]))));
  } catch {}
}
