import React from "react";
import { Settings, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Brand template settings, kept out of the way of normal staff.
export function AdminSheet({ admin, setAdmin, onLogoFile }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Admin settings" title="Admin settings">
          <Settings />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Admin settings</SheetTitle>
          <SheetDescription>Brand template settings for the signatures made on this page.</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-6">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="text-sm font-medium">Brand template owners only</div>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">These change the website link and the logo on the official banner.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-website">Official website URL</Label>
            <Input id="admin-website" value={admin.website} onChange={(e) => setAdmin((a) => ({ ...a, website: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Company logo</Label>
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-[#1f2a31] px-3 py-2">
                <img src={admin.logoUrl} alt="Current logo" className="block h-6" />
              </div>
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  Replace
                  <input type="file" accept="image/png,image/svg+xml" className="hidden" onChange={onLogoFile} />
                </label>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">White PNG or SVG. Only shown on the official banner.</p>
          </div>
        </div>
        <SheetFooter className="p-6">
          <SheetClose asChild>
            <Button>Done</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
