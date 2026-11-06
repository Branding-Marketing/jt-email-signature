import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Download, Loader2, Monitor, RotateCcw, Save, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { AdminSheet } from "@/components/AdminSheet";
import { BannerPicker } from "@/components/BannerPicker";
import { FeishuAccountMenu, FeishuStatus } from "@/components/FeishuAccount";
import { InstallGuide } from "@/components/InstallGuide";
import { PhotoCropper } from "@/components/PhotoCropper";
import { SignaturePreview } from "@/components/SignaturePreview";
import { StepBadge } from "@/components/StepBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FEISHU_ERRORS, loadSavedFields, profileName, storeSavedFields, toCircularPng } from "@/lib/feishu";
import {
  DEFAULT_LOGO_SVG,
  OFFICIAL_WEBSITE_URL,
  copySignatureToClipboard,
  isValidBannerLink,
  isValidEmail,
  isValidLinkedIn,
  renderSignatureCanvas,
} from "@/lib/signature";
import { cn } from "@/lib/utils";

const EMPTY_FORM = { name: "", title: "", mobile: "", email: "", linkedin: "", photoDataUrl: "" };

function Field({ id, label, required, error, badge, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="gap-1">
          {label}
          {required && <span className="text-primary">*</span>}
        </Label>
        {badge && (
          <Badge variant="secondary" className="h-[18px] rounded-full bg-feishu/10 px-1.5 text-[11px] text-feishu" title="Filled in from Feishu">
            {badge}
          </Badge>
        )}
      </div>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...loadSavedFields() }));
  const [admin, setAdmin] = useState({
    website: OFFICIAL_WEBSITE_URL,
    logoUrl: DEFAULT_LOGO_SVG,
    bannerMode: "official",
    customBannerUrl: "",
    customBannerLink: "",
  });
  const [showPhoto, setShowPhoto] = useState(false);
  const [showLinkedin, setShowLinkedin] = useState(() => !!form.linkedin);
  const [cropSrc, setCropSrc] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [previewWidth, setPreviewWidth] = useState("desktop");
  const [feishu, setFeishu] = useState({ status: "loading", profile: null, error: "" });
  // Values that came from Feishu, so the matching fields can be marked while unchanged
  const [fromFeishu, setFromFeishu] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    storeSavedFields(form);
  }, [form.title, form.mobile, form.email, form.linkedin]);

  // Fills the form from a Feishu profile. Only fields Feishu actually returned are touched,
  // so anything missing (e.g. mobile) stays editable by hand.
  const applyProfile = useCallback(async (p) => {
    let photo = "";
    if (p.avatarDataUrl) {
      try { photo = await toCircularPng(p.avatarDataUrl); } catch {}
    }
    const filled = { name: profileName(p), title: p.title || "", email: p.email || "", mobile: p.mobile || "", photoDataUrl: photo };
    setForm((f) => ({
      ...f,
      name: filled.name || f.name,
      title: filled.title || f.title,
      email: filled.email || f.email,
      mobile: filled.mobile || f.mobile,
      photoDataUrl: filled.photoDataUrl || f.photoDataUrl,
    }));
    setFromFeishu(Object.fromEntries(Object.entries(filled).filter(([, v]) => v)));
    if (photo) setShowPhoto(true);
    setErrors({});
  }, []);

  useEffect(() => {
    // The login callback returns here with ?feishu=<error> when something went wrong
    const params = new URLSearchParams(window.location.search);
    const loginError = FEISHU_ERRORS[params.get("feishu")] || "";
    if (params.has("feishu")) window.history.replaceState(null, "", window.location.pathname);
    let cancelled = false;
    fetch("/api/me", { credentials: "same-origin" })
      .then(async (res) => (res.ok ? { profile: await res.json() } : { status: res.status }))
      .catch(() => ({ status: 0 }))
      .then(({ profile, status }) => {
        if (cancelled) return;
        if (profile) {
          setFeishu({ status: "signed-in", profile, error: "" });
          applyProfile(profile);
        } else if (status === 401) {
          setFeishu({ status: "signed-out", profile: null, error: loginError });
        } else {
          // Session is kept on the server side; a refresh retries without signing in again
          setFeishu({ status: "signed-out", profile: null, error: "Feishu is temporarily unavailable. Please refresh the page in a moment." });
        }
      });
    return () => { cancelled = true; };
  }, [applyProfile]);

  const signInWithFeishu = () => { window.location.href = "/api/auth/feishu/login"; };
  const signOutOfFeishu = async () => {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch {}
    setFeishu({ status: "signed-out", profile: null, error: "" });
    setFromFeishu({});
  };
  const refillFromFeishu = () => feishu.profile && applyProfile(feishu.profile);

  const validate = useCallback(() => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (!form.title.trim()) e.title = "Job title is required.";
    if (!form.email.trim() || !isValidEmail(form.email)) e.email = "Enter a valid email address.";
    if (form.linkedin && !isValidLinkedIn(form.linkedin)) e.linkedin = "Enter a valid LinkedIn URL.";
    if (admin.bannerMode === "custom" && !admin.customBannerUrl) e.customBannerUrl = "Upload a 4:1 JPG or PNG banner for the custom option.";
    if (admin.bannerMode === "custom" && !isValidBannerLink(admin.customBannerLink)) e.customBannerLink = "Enter a valid website URL for the custom banner.";
    setErrors(e);
    const valid = Object.keys(e).length === 0;
    if (!valid) toast.error("Please complete the fields marked in red.");
    return valid;
  }, [form, admin.bannerMode, admin.customBannerUrl, admin.customBannerLink]);

  // Editing a field clears its error straight away instead of waiting for the next export
  const update = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setErrors((prev) => ({ ...prev, photo: "Please upload a JPG or PNG file." }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: "Photo must be under 5MB." }));
      return;
    }
    setErrors((prev) => ({ ...prev, photo: undefined }));
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  const onLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAdmin((a) => ({ ...a, logoUrl: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const onCustomBannerFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setErrors((prev) => ({ ...prev, customBannerUrl: "Please upload a JPG or PNG banner." }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, customBannerUrl: "Banner must be under 10MB." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (Math.abs(ratio - 4) > 0.08) {
          setErrors((prev) => ({ ...prev, customBannerUrl: `Please upload a 4:1 banner (for example 1600×400). Current image is ${img.width}×${img.height}.` }));
          return;
        }
        setErrors((prev) => ({ ...prev, customBannerUrl: undefined }));
        setAdmin((a) => ({ ...a, bannerMode: "custom", customBannerUrl: dataUrl }));
      };
      img.onerror = () => setErrors((prev) => ({ ...prev, customBannerUrl: "The custom banner could not be read. Please try another file." }));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setFromFeishu({});
    setShowPhoto(false);
    setShowLinkedin(false);
    setErrors({});
  };

  const exportState = { form, admin, showPhoto: showPhoto && !!form.photoDataUrl, showLinkedin: showLinkedin && !!form.linkedin };

  const copySignature = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const copied = await copySignatureToClipboard(exportState);
      if (copied) {
        toast.success("Signature copied", { description: "Paste it into your email signature settings. See “Install it” for the steps." });
      } else {
        toast.error("Your browser blocked clipboard access", { description: "Open this page in Chrome or Edge and try again." });
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadPng = async (hires) => {
    if (!validate()) return;
    setBusy(true);
    try {
      const { canvas } = await renderSignatureCanvas(exportState, hires ? 3 : 2);
      const link = document.createElement("a");
      link.download = `jt-signature-${(form.name || "employee").replace(/\s+/g, "-").toLowerCase()}${hires ? "@3x" : "@2x"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PNG downloaded");
    } catch {
      toast.error("The PNG could not be created", { description: "Please try a smaller JPG or PNG banner." });
    } finally {
      setBusy(false);
    }
  };

  const feishuBadge = (key) => (fromFeishu[key] && fromFeishu[key] === form[key] ? "Feishu" : null);
  const avatarUrl = fromFeishu.photoDataUrl || "";

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
        <div className="flex rounded-md bg-primary px-2 py-1.5">
          <img src={admin.logoUrl} alt="J&T Express" className="block h-[18px]" />
        </div>
        <h1 className="truncate text-[15px] font-semibold tracking-tight">Email Signature</h1>
        <Badge variant="outline" className="hidden rounded-full sm:inline-flex">Australia</Badge>
        <div className="flex-1" />
        <FeishuAccountMenu feishu={feishu} avatarUrl={avatarUrl} onSignIn={signInWithFeishu} onRefill={refillFromFeishu} onSignOut={signOutOfFeishu} />
        <AdminSheet admin={admin} setAdmin={setAdmin} onLogoFile={onLogoFile} />
      </header>

      <main className="mx-auto grid max-w-[1320px] grid-cols-1 items-start gap-4 p-4 sm:p-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-6">
        {/* Left: the form */}
        <div className="flex flex-col gap-4">
          <FeishuStatus feishu={feishu} avatarUrl={avatarUrl} onSignIn={signInWithFeishu} onRefill={refillFromFeishu} />

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><StepBadge>1</StepBadge>Your details</CardTitle>
              <CardDescription>Shown in the text part of your signature.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="name" label="Full name" required error={errors.name} badge={feishuBadge("name")}>
                  <Input id="name" value={form.name} onChange={update("name")} placeholder="Full name" aria-invalid={!!errors.name} />
                </Field>
                <Field id="title" label="Job title" required error={errors.title} badge={feishuBadge("title")}>
                  <Input id="title" value={form.title} onChange={update("title")} placeholder="Job title" aria-invalid={!!errors.title} />
                </Field>
                <Field id="mobile" label="Mobile" badge={feishuBadge("mobile")}>
                  <Input id="mobile" value={form.mobile} onChange={update("mobile")} placeholder="+61 4 0000 0000" />
                </Field>
                <Field id="email" label="Email" required error={errors.email} badge={feishuBadge("email")}>
                  <Input id="email" type="email" value={form.email} onChange={update("email")} placeholder="name@jtexpress.com" aria-invalid={!!errors.email} />
                </Field>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="size-3.5" /> Title, mobile, email and LinkedIn are saved in this browser.
              </p>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StepBadge>2</StepBadge>Photo &amp; LinkedIn <Badge variant="secondary" className="rounded-full">Optional</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {form.photoDataUrl ? (
                  <img src={form.photoDataUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="size-12 shrink-0 rounded-full border border-dashed bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <Label htmlFor="show-photo">Profile photo</Label>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    {fromFeishu.photoDataUrl && fromFeishu.photoDataUrl === form.photoDataUrl && <span>From Feishu ·</span>}
                    <Button variant="link" className="h-auto p-0 text-xs" onClick={() => fileInputRef.current?.click()}>
                      {form.photoDataUrl ? "Upload another" : "Upload a photo"}
                    </Button>
                    {!form.photoDataUrl && <span>· square, 400×400px or larger</span>}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={onFile} />
                </div>
                <Switch id="show-photo" checked={showPhoto && !!form.photoDataUrl} disabled={!form.photoDataUrl} onCheckedChange={setShowPhoto} aria-label="Show photo in signature" />
              </div>
              {errors.photo && <p className="text-xs font-medium text-destructive">{errors.photo}</p>}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-linkedin text-base font-bold text-white">in</div>
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="show-linkedin">LinkedIn badge</Label>
                    <p className="mt-1 text-xs text-muted-foreground">A small clickable icon next to your photo.</p>
                  </div>
                  <Switch id="show-linkedin" checked={showLinkedin && !!form.linkedin} disabled={!form.linkedin} onCheckedChange={setShowLinkedin} aria-label="Show LinkedIn in signature" />
                </div>
                <Field id="linkedin" label="LinkedIn profile URL" error={errors.linkedin}>
                  <Input
                    id="linkedin"
                    value={form.linkedin}
                    onChange={(e) => {
                      // Turn the badge on with the first character typed, off when the URL is cleared
                      if (!form.linkedin && e.target.value) setShowLinkedin(true);
                      update("linkedin")(e);
                    }}
                    placeholder="https://linkedin.com/in/…"
                    aria-invalid={!!errors.linkedin}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><StepBadge>3</StepBadge>Banner</CardTitle>
              <CardDescription>Pick artwork for under your details, or leave it out for a plain signature.</CardDescription>
            </CardHeader>
            <CardContent>
              <BannerPicker admin={admin} setAdmin={setAdmin} errors={errors} onCustomBannerFile={onCustomBannerFile} />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>Everything stays in your browser.</span>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={reset}>
              <RotateCcw /> Clear my details
            </Button>
          </div>
        </div>

        {/* Right: preview, actions and install guide. On small screens the preview moves above the form. */}
        <div className="contents lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-4">
          <Card className="order-first gap-0 py-0 lg:order-none">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3 py-5">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Preview
                  <Badge variant="secondary" className="rounded-full bg-success/10 text-success">
                    <span className="size-1.5 rounded-full bg-success" /> Live
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1.5">This is how it looks in an email.</CardDescription>
              </div>
              <Tabs value={previewWidth} onValueChange={setPreviewWidth}>
                <TabsList>
                  <TabsTrigger value="desktop"><Monitor /> Desktop</TabsTrigger>
                  <TabsTrigger value="mobile"><Smartphone /> Mobile</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <div className="border-y bg-muted p-3 sm:p-7">
              <div className={cn("mx-auto overflow-hidden rounded-lg border bg-white shadow-lg shadow-black/5 transition-[max-width] duration-300", previewWidth === "mobile" ? "max-w-[360px]" : "max-w-[720px]")}>
                <div className="grid gap-0.5 border-b px-4 py-2.5 text-xs text-muted-foreground">
                  <div><span className="mr-1.5 font-medium text-foreground">To</span>customer@example.com</div>
                  <div><span className="mr-1.5 font-medium text-foreground">Subject</span>Re: Delivery schedule update</div>
                </div>
                <div className="p-4">
                  <div className="mb-5 space-y-2" aria-hidden="true">
                    <div className="h-2 w-[92%] rounded bg-muted" />
                    <div className="h-2 w-[76%] rounded bg-muted" />
                    <div className="h-2 w-[38%] rounded bg-muted" />
                  </div>
                  <div className="max-w-[650px]">
                    <SignaturePreview form={form} admin={admin} showPhoto={exportState.showPhoto} showLinkedin={exportState.showLinkedin} />
                  </div>
                </div>
              </div>
            </div>
            <CardFooter className="flex-wrap gap-2 py-4">
              <Button size="lg" onClick={copySignature} disabled={busy} className="flex-1 sm:flex-none">
                {busy ? <Loader2 className="animate-spin" /> : <Copy />} Copy signature
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg" variant="outline" disabled={busy}>
                    <Download /> Download PNG <ChevronDown className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Image size</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => downloadPng(false)}>
                    Standard <span className="ml-auto text-xs text-muted-foreground">@2x</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => downloadPng(true)}>
                    High resolution <span className="ml-auto text-xs text-muted-foreground">@3x</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Paste into Outlook or Gmail ↓</span>
            </CardFooter>
          </Card>

          <InstallGuide className="order-last lg:order-none" />
        </div>
      </main>

      {cropSrc && (
        <PhotoCropper
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onConfirm={(dataUrl) => {
            setForm((f) => ({ ...f, photoDataUrl: dataUrl }));
            setShowPhoto(true);
            setCropSrc(null);
          }}
        />
      )}
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
