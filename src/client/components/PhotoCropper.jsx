import React, { useRef, useState } from "react";
import { ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

const BOX_SIZE = 260; // on-screen crop box size in px
const MIN_ZOOM = 1;
const MAX_ZOOM = 1.8;
const OUTPUT_SIZE = 400;

// Drag + zoom circular crop. Produces a 400×400 circular PNG so Outlook (which ignores
// border-radius) still shows a round photo.
export function PhotoCropper({ imageSrc, onConfirm, onCancel }) {
  const [scale, setScale] = useState(MIN_ZOOM);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [naturalDims, setNaturalDims] = useState(null);
  const dragRef = useRef(null);
  const imgRef = useRef(null);

  // Scale that makes the image exactly cover the crop box, regardless of its native size.
  // The zoom slider only controls zoom relative to that fit, so its range stays small and predictable.
  const baseScale = naturalDims ? BOX_SIZE / Math.min(naturalDims.w, naturalDims.h) : 1;
  const displayScale = baseScale * scale;

  const onImgLoad = (e) => {
    setNaturalDims({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    setPos({ x: 0, y: 0 });
    setScale(MIN_ZOOM);
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setPos({ x: dragRef.current.origX + e.clientX - dragRef.current.startX, y: dragRef.current.origY + e.clientY - dragRef.current.startY });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const confirm = () => {
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    const img = imgRef.current;
    const naturalScale = OUTPUT_SIZE / BOX_SIZE;
    const effScale = (BOX_SIZE / Math.min(img.naturalWidth, img.naturalHeight)) * scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const drawW = img.naturalWidth * effScale * naturalScale;
    const drawH = img.naturalHeight * effScale * naturalScale;
    const drawX = OUTPUT_SIZE / 2 - drawW / 2 + pos.x * naturalScale;
    const drawY = OUTPUT_SIZE / 2 - drawH / 2 + pos.y * naturalScale;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    onConfirm(canvas.toDataURL("image/png"));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Crop photo</DialogTitle>
          <DialogDescription>Drag to reposition, use the slider to zoom.</DialogDescription>
        </DialogHeader>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-full border-2 border-dashed border-primary bg-muted active:cursor-grabbing"
          style={{ width: BOX_SIZE, height: BOX_SIZE }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            draggable={false}
            onLoad={onImgLoad}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none"
            style={{ transform: `translate(-50%,-50%) translate(${pos.x}px,${pos.y}px) scale(${displayScale})` }}
          />
        </div>
        <div className="flex items-center gap-3">
          <ZoomIn className="size-4 text-muted-foreground" />
          <Slider min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={[scale]} onValueChange={([v]) => setScale(v)} aria-label="Zoom" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={confirm}>Use photo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
