import React from "react";

import { BRAND, FONT, getActiveBannerLink, getActiveBannerUrl, hasBanner, isValidBannerLink, normalizeUrl } from "@/lib/signature";

// On-screen signature. Keep in sync with renderSignatureCanvas and buildEmailSignatureHtml.
// Design baseline is a 650px-wide signature. Container query units (cqw) keep every px-based value
// proportional to the rendered width, so desktop and mobile previews are the same design at two sizes.
const BASELINE = 650;
const cq = (px) => `${((px / BASELINE) * 100).toFixed(3)}cqw`;

export function SignaturePreview({ form, admin, showPhoto, showLinkedin }) {
  const bannerUrl = getActiveBannerUrl(admin);
  const bannerLink = getActiveBannerLink(admin);

  return (
    <div style={{ width: "100%", background: "#fff", fontFamily: FONT, containerType: "inline-size", borderLeft: `${cq(6)} solid ${BRAND.red}` }}>
      <div style={{ padding: `${cq(17)} ${cq(22)} ${cq(14)} ${cq(20)}`, display: "flex", justifyContent: "space-between", gap: cq(18) }}>
        <div style={{ flex: 1 }}>
          <div style={{ font: `400 ${cq(12)} ${FONT}`, color: BRAND.textSupporting }}>Kind regards,</div>
          <div style={{ marginTop: cq(5), font: `700 ${cq(21)} ${FONT}`, color: BRAND.text }}>{form.name || "Full Name"}</div>
          <div style={{ marginTop: cq(4), font: `700 ${cq(13)} ${FONT}`, color: BRAND.textSecondary }}>{form.title || "Job Title"}</div>
          <div style={{ font: `400 ${cq(13)} ${FONT}`, color: BRAND.textSecondary }}>J&amp;T Express Australia</div>
          <div style={{ borderTop: "1px solid #e4e6e8", marginTop: cq(10), paddingTop: cq(8) }}>
            {form.mobile && <div style={{ font: `400 ${cq(13)} ${FONT}`, lineHeight: 1.5 }}><b style={{ color: BRAND.textSupporting, marginRight: cq(14) }}>M</b>{form.mobile}</div>}
            <div style={{ font: `400 ${cq(13)} ${FONT}`, lineHeight: 1.5, color: BRAND.red }}><b style={{ color: BRAND.textSupporting, marginRight: cq(14) }}>E</b>{form.email || "name@jtexpress.com"}</div>
            <div style={{ font: `400 ${cq(13)} ${FONT}`, lineHeight: 1.5 }}><b style={{ color: BRAND.textSupporting, marginRight: cq(14) }}>W</b>{admin.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>
          {showPhoto && <img src={form.photoDataUrl} alt={form.name} style={{ width: cq(76), height: cq(76), borderRadius: "50%", objectFit: "cover", border: `${cq(3)} solid #fff`, boxShadow: `0 ${cq(3)} ${cq(10)} rgba(0,0,0,.18)` }} />}
          {showLinkedin && <div style={{ width: cq(28), height: cq(28), borderRadius: cq(5), background: BRAND.linkedin, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", font: `700 ${cq(12)} ${FONT}` }}>in</div>}
        </div>
      </div>
      {hasBanner(admin) && (
        <div style={{ position: "relative", width: "100%", overflow: "hidden", background: "#1f2a31" }}>
          <a href={bannerLink.trim() && isValidBannerLink(bannerLink) ? normalizeUrl(bannerLink) : undefined} target="_blank" rel="noopener noreferrer" aria-label="Open signature banner link" style={{ display: "block", position: "relative", textDecoration: "none", cursor: bannerLink.trim() && isValidBannerLink(bannerLink) ? "pointer" : "default" }}>
            <img src={bannerUrl} alt="" style={{ display: "block", width: "100%", height: "auto" }} />
            {admin.bannerMode === "official" && <img src={admin.logoUrl} alt="J&T Express" style={{ position: "absolute", width: "24%", height: "auto", right: "3.5%", top: "7%", filter: `drop-shadow(0 ${cq(2)} ${cq(5)} rgba(0,0,0,.4))` }} />}
          </a>
        </div>
      )}
    </div>
  );
}
