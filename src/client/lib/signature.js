// Signature model and the two export paths (canvas PNG and email-safe HTML).
// The on-screen SignaturePreview, renderSignatureCanvas and buildEmailSignatureHtml draw the
// same signature three ways and must be kept visually in sync by hand.
import { DEFAULT_LOGO_SVG, OFFICIAL_BANNER_4X1, OFFICIAL_WEBSITE_URL, DSP_FORM_URL, DSP_BANNER_JPG } from "@/assets";

export { DEFAULT_LOGO_SVG, OFFICIAL_WEBSITE_URL, OFFICIAL_BANNER_4X1 as OFFICIAL_BANNER_URL, DSP_BANNER_JPG as DSP_BANNER_URL };


export const BRAND = {
  red: "#D9291C",
  linkedin: "#0A66C2",
  text: "#202428",
  textSecondary: "#4B5054",
  textSupporting: "#858A8E",
  cardBg: "#FFFFFF",
  page: "#F3F4F6",
};

export const FONT = "Arial, Helvetica, sans-serif";



// ---------- Helpers ----------
export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const isValidUrl = (v) => {
  if (!v) return true;
  try {
    const u = new URL(v.startsWith("http") ? v : `https://${v}`);
    return !!u.hostname;
  } catch {
    return false;
  }
};
export const isValidLinkedIn = (v) => {
  if (!v) return true;
  return isValidUrl(v) && /linkedin\.com/i.test(v);
};

// The banner click-through is intentionally restricted to normal web links.
export const isValidBannerLink = (v) => {
  if (!v || !v.trim()) return true;
  try {
    const candidate = /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`;
    const url = new URL(candidate);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
};

export function normalizeUrl(v) {
  if (!v) return "";
  return /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`;
}


export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const BANNER_MODE_OPTIONS = [
  { id: "official", label: "Official", description: "Links to jtexpress.au" },
  { id: "dsp", label: "DSP recruitment", description: "Links to the DSP recruitment form" },
  { id: "custom", label: "Custom", description: "Upload a 4:1 JPG or PNG" },
  { id: "none", label: "No banner", description: "Text only, more formal" },
];

// "none" leaves the banner out of the preview, the copied HTML and the PNG.
export const hasBanner = (admin) => admin.bannerMode !== "none";

export function getActiveBannerUrl(admin) {
  if (admin.bannerMode === "none") return "";
  if (admin.bannerMode === "dsp") return DSP_BANNER_JPG;
  if (admin.bannerMode === "custom") return admin.customBannerUrl || OFFICIAL_BANNER_4X1;
  return OFFICIAL_BANNER_4X1;
}

export function getActiveBannerLink(admin) {
  if (admin.bannerMode === "none") return "";
  if (admin.bannerMode === "dsp") return DSP_FORM_URL;
  if (admin.bannerMode === "custom") return admin.customBannerLink || "";
  return OFFICIAL_WEBSITE_URL;
}

export function getBannerModeMeta(mode) {
  return BANNER_MODE_OPTIONS.find((option) => option.id === mode) || BANNER_MODE_OPTIONS[0];
}

  const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Draws the whole signature with Canvas 2D for the PNG download.
export async function renderSignatureCanvas({ form, admin, showPhoto, showLinkedin }, pixelScale) {
  const w = 650;
  const infoH = 176;
  const withBanner = hasBanner(admin);
  let bannerImg = null;
  if (withBanner) {
    try { bannerImg = await loadImage(getActiveBannerUrl(admin)); } catch {}
  }
  const bannerH = !withBanner ? 0 : bannerImg ? Math.round((w - 6) * bannerImg.height / bannerImg.width) : 161;
  const h = infoH + bannerH;
  const canvas = document.createElement("canvas");
  canvas.width = w * pixelScale;
  canvas.height = h * pixelScale;
  const ctx = canvas.getContext("2d");
  ctx.scale(pixelScale, pixelScale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // Contact panel.
  ctx.fillStyle = BRAND.red;
  ctx.fillRect(0, 0, 6, h);
  const x = 26;
  ctx.fillStyle = BRAND.textSupporting;
  ctx.font = "400 12px Arial";
  ctx.fillText("Kind regards,", x, 25);
  ctx.fillStyle = BRAND.text;
  ctx.font = "700 21px Arial";
  ctx.fillText(form.name || "Full Name", x, 51);
  ctx.fillStyle = BRAND.textSecondary;
  ctx.font = "700 13px Arial";
  ctx.fillText(form.title || "Job Title", x, 73);
  ctx.font = "400 13px Arial";
  ctx.fillText("J&T Express Australia", x, 92);
  ctx.strokeStyle = "#e4e6e8";
  ctx.beginPath();
  ctx.moveTo(x, 108);
  ctx.lineTo(w - 22, 108);
  ctx.stroke();
  let rowY = 130;
  const drawContact = (label, value, color) => {
    if (!value) return;
    ctx.fillStyle = BRAND.textSupporting;
    ctx.font = "700 11px Arial";
    ctx.fillText(label, x, rowY);
    ctx.fillStyle = color;
    ctx.font = "400 13px Arial";
    ctx.fillText(value, x + 38, rowY);
    rowY += 20;
  };
  drawContact("M", form.mobile, BRAND.text);
  drawContact("E", form.email || "name@jtexpress.com", BRAND.red);
  drawContact("W", admin.website.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/\/$/, ""), BRAND.text);

  if (showLinkedin && form.linkedin) {
    ctx.fillStyle = BRAND.linkedin;
    roundRect(ctx, w - 45, 128, 28, 28, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("in", w - 31, 143);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  if (showPhoto && form.photoDataUrl) {
    try {
      const photoImg = await loadImage(form.photoDataUrl);
      const d = 76;
      const px = w - 116;
      const py = 22;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px + d / 2, py + d / 2, d / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(photoImg, px, py, d, d);
      ctx.restore();
    } catch {}
  }

  // Full-width brand artwork below the contact panel, fitted without cropping.
  if (withBanner) {
    ctx.fillStyle = "#1f2a31";
    ctx.fillRect(6, infoH, w - 6, bannerH);
  }
  if (bannerImg) ctx.drawImage(bannerImg, 6, infoH, w - 6, bannerH);
  if (admin.bannerMode === "official") {
    try {
      const logoImg = await loadImage(admin.logoUrl);
      const ratio = Math.min(155 / logoImg.width, 52 / logoImg.height);
      const lw = logoImg.width * ratio;
      const lh = logoImg.height * ratio;
      ctx.drawImage(logoImg, w - lw - 24, infoH + 20, lw, lh);
    } catch {}
  }

  return { canvas, w, h };
}

// Flattens the banner (plus the logo overlay for the official banner) into one image for email.
async function renderEmailBanner(admin) {
  // Preserve the original artwork's exact aspect ratio (including future banners).
  // The preview uses width:100% / height:auto, so the email must do the same.
  let bannerImg = null;
  try { bannerImg = await loadImage(getActiveBannerUrl(admin)); } catch {}
  const visualHeight = bannerImg ? Math.round(1300 * bannerImg.height / bannerImg.width) : 520;
  const visualCanvas = document.createElement("canvas");
  visualCanvas.width = 1300;
  visualCanvas.height = visualHeight;
  const visualCtx = visualCanvas.getContext("2d");
  visualCtx.fillStyle = "#1f2a31";
  visualCtx.fillRect(0, 0, 1300, visualHeight);
  if (bannerImg) visualCtx.drawImage(bannerImg, 0, 0, 1300, visualHeight);
  const emailBannerHeight = Math.round(644 * visualHeight / 1300);
  try {
    if (admin.bannerMode !== "official") throw new Error("No logo overlay for campaign artwork");
    const logoImg = await loadImage(admin.logoUrl);
    const maxW = 310;
    const maxH = 104;
    const ratio = Math.min(maxW / logoImg.width, maxH / logoImg.height);
    const logoW = logoImg.width * ratio;
    const logoH = logoImg.height * ratio;
    visualCtx.save();
    visualCtx.shadowColor = "rgba(0,0,0,.42)";
    visualCtx.shadowBlur = 10;
    visualCtx.drawImage(logoImg, 1300 - logoW - 42, 34, logoW, logoH);
    visualCtx.restore();
  } catch {
    // The banner still works if a custom logo cannot be rendered.
  }

  return { dataUrl: visualCanvas.toDataURL("image/jpeg", 0.86), height: emailBannerHeight };
}

// Email-safe export. The preview is deliberately not copied: it uses container units and
// layers that Outlook/Gmail are free to rewrite. Instead this builds a conservative table layout
// with real, clickable text and a flattened banner image.
export async function buildEmailSignatureHtml({ form, admin, showPhoto, showLinkedin }) {
  const banner = hasBanner(admin) ? await renderEmailBanner(admin) : null;
  const useLinkedin = showLinkedin && !!form.linkedin;
  const usePhoto = showPhoto && !!form.photoDataUrl;
  let linkedinDataUrl = "";
  if (useLinkedin) {
    const linkedinCanvas = document.createElement("canvas");
    linkedinCanvas.width = 56;
    linkedinCanvas.height = 56;
    const linkedinCtx = linkedinCanvas.getContext("2d");
    linkedinCtx.fillStyle = BRAND.linkedin;
    roundRect(linkedinCtx, 0, 0, 56, 56, 9);
    linkedinCtx.fill();
    linkedinCtx.fillStyle = "#ffffff";
    linkedinCtx.font = "700 25px Arial";
    linkedinCtx.textAlign = "center";
    linkedinCtx.textBaseline = "middle";
    linkedinCtx.fillText("in", 28, 30);
    linkedinDataUrl = linkedinCanvas.toDataURL("image/png");
  }
  const phoneHref = String(form.mobile || "").replace(/[^+\d]/g, "");
  const websiteHref = escapeHtml(normalizeUrl(admin.website));
  const bannerLink = getActiveBannerLink(admin);
  const bannerHref = bannerLink.trim() ? escapeHtml(normalizeUrl(bannerLink)) : "";
  const websiteText = escapeHtml(admin.website.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/\/$/, ""));
  const hasSocial = usePhoto || useLinkedin;
  const leftWidth = hasSocial ? 508 : 602;
  // A two-column header (info and social). Contact rows and divider stay INSIDE
  // the left column. The right cell has a top photo + bottom LinkedIn slot.
  // Fixed spacer cells stop Outlook from converting CSS padding into new widths.
  const photoCell = hasSocial ? `<td width="94" align="center" valign="top" style="width:94px;padding:0;vertical-align:top;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="94" height="160" style="width:94px;height:160px;border-collapse:collapse;">
      <tr><td height="93" align="center" valign="top" style="height:93px;text-align:center;vertical-align:top;">
        ${usePhoto ? `<img src="${form.photoDataUrl}" alt="${escapeHtml(form.name)}" width="76" height="76" style="display:block;margin:0 auto;width:76px;height:76px;border:3px solid #ffffff;border-radius:50%;" />` : "&nbsp;"}
      </td></tr>
      <tr><td height="67" align="center" valign="bottom" style="height:67px;text-align:center;vertical-align:bottom;padding-bottom:1px;">
        ${useLinkedin ? `<a href="${escapeHtml(normalizeUrl(form.linkedin))}" style="text-decoration:none;"><img src="${linkedinDataUrl}" alt="LinkedIn" width="28" height="28" style="display:block;margin:0 auto;width:28px;height:28px;border:0;outline:none;" /></a>` : "&nbsp;"}
      </td></tr>
    </table>
  </td>` : "";

  const bannerRow = banner ? `<tr>
  <td width="6" bgcolor="#D9291C" style="width:6px;background-color:#D9291C;font-size:0;line-height:0;">&nbsp;</td>
  <td width="644" bgcolor="#ffffff" style="width:644px;padding:0;background-color:#ffffff;">
    ${bannerHref ? `<a href="${bannerHref}" style="display:block;text-decoration:none;border:0;">` : ""}
    <img src="${banner.dataUrl}" width="644" height="${banner.height}" alt="J&amp;T Express Australia" style="display:block;width:644px;height:${banner.height}px;border:0;outline:none;text-decoration:none;" />
    ${bannerHref ? "</a>" : ""}
  </td>
</tr>` : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="650" style="width:650px;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
<tr>
  <td width="6" bgcolor="#D9291C" style="width:6px;background-color:#D9291C;font-size:0;line-height:0;">&nbsp;</td>
  <td width="644" bgcolor="#ffffff" style="width:644px;padding:0;background-color:#ffffff;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="644" style="width:644px;border-collapse:collapse;table-layout:fixed;">
      <tr>
        <td width="20" style="width:20px;font-size:0;line-height:0;">&nbsp;</td>
        <td width="602" valign="top" style="width:602px;padding-top:17px;padding-bottom:14px;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="602" style="width:602px;border-collapse:collapse;table-layout:fixed;">
            <tr>
              <td width="${leftWidth}" valign="top" style="width:${leftWidth}px;vertical-align:top;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${leftWidth}" style="width:${leftWidth}px;border-collapse:collapse;table-layout:fixed;font-family:Arial,Helvetica,sans-serif;">
                  <tr><td style="font-size:12px;line-height:16px;color:#858A8E;">Kind regards,</td></tr>
                  <tr><td height="30" style="height:30px;font-size:21px;font-weight:bold;line-height:25px;color:#202428;white-space:nowrap;">${escapeHtml(form.name)}</td></tr>
                  <tr><td height="20" style="height:20px;font-size:13px;font-weight:bold;line-height:17px;color:#4B5054;white-space:nowrap;">${escapeHtml(form.title)}</td></tr>
                  <tr><td height="17" style="height:17px;font-size:13px;line-height:17px;color:#4B5054;">J&amp;T Express Australia</td></tr>
                  <tr><td height="11" style="height:11px;border-bottom:1px solid #E4E6E8;font-size:0;line-height:0;">&nbsp;</td></tr>
                  <tr><td height="8" style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
                  <tr><td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${leftWidth}" style="width:${leftWidth}px;border-collapse:collapse;table-layout:fixed;font-family:Arial,Helvetica,sans-serif;">
                      ${form.mobile ? `<tr><td width="22" style="width:22px;color:#858A8E;font-size:11px;font-weight:bold;line-height:19px;">M</td><td style="font-size:13px;line-height:19px;white-space:nowrap;"><a href="tel:${phoneHref}" style="color:#202428;text-decoration:none;">${escapeHtml(form.mobile)}</a></td></tr>` : ""}
                      <tr><td width="22" style="width:22px;color:#858A8E;font-size:11px;font-weight:bold;line-height:19px;">E</td><td style="font-size:13px;line-height:19px;white-space:nowrap;"><a href="mailto:${escapeHtml(form.email)}" style="color:#D9291C;text-decoration:none;">${escapeHtml(form.email)}</a></td></tr>
                      <tr><td width="22" style="width:22px;color:#858A8E;font-size:11px;font-weight:bold;line-height:19px;">W</td><td style="font-size:13px;line-height:19px;white-space:nowrap;"><a href="${websiteHref}" style="color:#202428;text-decoration:none;">${websiteText}</a></td></tr>
                    </table>
                  </td></tr>
                </table>
              </td>
              ${photoCell}
            </tr>
          </table>
        </td>
        <td width="22" style="width:22px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
    </table>
  </td>
</tr>
${bannerRow}
</table>`;
}

// Writes the signature to the clipboard as rich HTML (+ plain text). Returns false when the
// browser blocks clipboard access.
export async function copySignatureToClipboard(state) {
  const { form, admin } = state;
  const html = await buildEmailSignatureHtml(state);
  try {
    const blob = new Blob([html], { type: "text/html" });
    const plainText = `${form.name}\n${form.title}\nJ&T Express Australia\n${form.mobile || ""}\n${form.email}\n${admin.website}`;
    const item = new ClipboardItem({ "text/html": blob, "text/plain": new Blob([plainText], { type: "text/plain" }) });
    await navigator.clipboard.write([item]);
  } catch {
    // Legacy fallback: select the rendered signature, never the HTML source code.
    const holder = document.createElement("div");
    holder.setAttribute("contenteditable", "true");
    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const range = document.createRange();
    range.selectNodeContents(holder);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const copied = document.execCommand("copy");
    selection.removeAllRanges();
    holder.remove();
    if (!copied) return false;
  }
  return true;
}