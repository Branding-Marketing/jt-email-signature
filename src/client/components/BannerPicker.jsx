import React, { useRef } from "react";
import { Info, Lock, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { BANNER_MODE_OPTIONS, DSP_BANNER_URL, OFFICIAL_BANNER_URL, getActiveBannerLink } from "@/lib/signature";

function BannerThumb({ id, customBannerUrl }) {
  const src = id === "official" ? OFFICIAL_BANNER_URL : id === "dsp" ? DSP_BANNER_URL : id === "custom" ? customBannerUrl : "";
  if (src) return <img src={src} alt="" className="block aspect-[4/1] w-full border-b object-cover" />;
  if (id === "none") {
    // A tiny sketch of a text-only signature.
    return (
      <div className="flex aspect-[4/1] w-full flex-col justify-center gap-1 border-b border-l-4 border-l-primary bg-background px-4">
        <div className="h-1.5 w-2/5 rounded-full bg-zinc-300" />
        <div className="h-1 w-3/5 rounded-full bg-zinc-200" />
        <div className="h-1 w-1/2 rounded-full bg-zinc-200" />
      </div>
    );
  }
  return (
    <div className="flex aspect-[4/1] w-full items-center justify-center border-b bg-muted text-muted-foreground">
      <Upload className="size-4" />
    </div>
  );
}

// Banner choice as image cards. Preset banners are locked to their own link; "none" drops the banner.
export function BannerPicker({ admin, setAdmin, errors, onCustomBannerFile }) {
  const fileRef = useRef(null);
  const mode = admin.bannerMode;
  const lockedLink = getActiveBannerLink(admin);

  return (
    <div className="space-y-4">
      <RadioGroup value={mode} onValueChange={(v) => setAdmin((a) => ({ ...a, bannerMode: v }))} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {BANNER_MODE_OPTIONS.map((option) => (
          <Label
            key={option.id}
            htmlFor={`banner-${option.id}`}
            className={cn(
              "block cursor-pointer overflow-hidden rounded-lg border bg-card font-normal transition-[border-color,box-shadow] hover:border-foreground/25",
              mode === option.id && "border-primary ring-1 ring-primary hover:border-primary"
            )}
          >
            <BannerThumb id={option.id} customBannerUrl={admin.customBannerUrl} />
            <div className="flex items-start gap-2.5 px-3 py-2.5">
              <RadioGroupItem value={option.id} id={`banner-${option.id}`} className="mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-medium">{option.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{option.description}</div>
              </div>
            </div>
          </Label>
        ))}
      </RadioGroup>

      {mode === "custom" && (
        <div className="space-y-4">
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload /> {admin.customBannerUrl ? "Replace banner" : "Upload 4:1 banner"}
            </Button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onCustomBannerFile} />
            {errors.customBannerUrl ? (
              <p className="mt-1.5 text-xs font-medium text-destructive">{errors.customBannerUrl}</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">JPG or PNG, 4:1 (for example 1600×400), under 10 MB.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-banner-link">Banner link (optional)</Label>
            <Input
              id="custom-banner-link"
              type="url"
              value={admin.customBannerLink}
              placeholder="https://example.com"
              aria-invalid={!!errors.customBannerLink}
              onChange={(e) => setAdmin((a) => ({ ...a, customBannerLink: e.target.value }))}
            />
            {errors.customBannerLink && <p className="text-xs font-medium text-destructive">{errors.customBannerLink}</p>}
          </div>
        </div>
      )}

      {(mode === "official" || mode === "dsp") && (
        <div className="space-y-2">
          <Label>Banner link</Label>
          <div className="flex h-9 items-center gap-2 rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            <span className="truncate">{lockedLink}</span>
          </div>
          <p className="text-xs text-muted-foreground">Each preset banner is locked to its own link, so the wrong pairing can't be sent.</p>
        </div>
      )}

      {mode === "none" && (
        <div className="flex items-start gap-3 rounded-lg border px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="text-sm font-medium">Plain signature</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Keeps the red bar, your details, the website link and the optional photo. The copied signature and PNG leave out the banner too.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
