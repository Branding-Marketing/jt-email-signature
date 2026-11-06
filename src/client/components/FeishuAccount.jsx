import React from "react";
import { ChevronDown, Loader2, LogIn, LogOut, RefreshCw, Sparkles } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { profileName } from "@/lib/feishu";

const initials = (name) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

// Header control: account menu when signed in, a sign-in button otherwise.
export function FeishuAccountMenu({ feishu, avatarUrl, onSignIn, onRefill, onSignOut }) {
  if (feishu.status === "loading") {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Checking Feishu sign-in" />;
  }
  if (feishu.status !== "signed-in") {
    return (
      <Button size="sm" onClick={onSignIn}>
        <LogIn /> Sign in with Feishu
      </Button>
    );
  }
  const name = profileName(feishu.profile) || feishu.profile.name;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-full pr-2.5 pl-1">
          <Avatar className="size-7">
            <AvatarImage src={avatarUrl} alt="" />
            <AvatarFallback className="text-[11px]">{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate sm:inline">{name}</span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">Signed in with Feishu</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onRefill}>
          <RefreshCw /> Fill again from Feishu
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Status card above the form. Signing in is optional: the form always works by hand.
export function FeishuStatus({ feishu, avatarUrl, onSignIn, onRefill }) {
  if (feishu.status === "loading") return null;
  if (feishu.status === "signed-in") {
    const name = profileName(feishu.profile) || feishu.profile.name;
    return (
      <div className="flex items-start gap-3 rounded-lg border border-feishu/20 bg-feishu/5 px-4 py-3">
        <Avatar className="size-10">
          <AvatarImage src={avatarUrl} alt="" />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Signed in with Feishu as {name}</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Details were filled in from Feishu where available. Anything you type is remembered in this browser.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefill}>
          <RefreshCw /> Refill
        </Button>
      </div>
    );
  }
  return (
    <Alert variant={feishu.error ? "destructive" : "default"} className="flex items-start gap-3">
      <Sparkles className={feishu.error ? "mt-0.5 size-4" : "mt-0.5 size-4 text-feishu"} />
      <div className="min-w-0 flex-1">
        <AlertTitle>{feishu.error ? "Feishu sign-in didn't work" : "Save time with Feishu"}</AlertTitle>
        <AlertDescription>{feishu.error || "Sign in to fill in your name, email and photo automatically. You can also fill everything in by hand."}</AlertDescription>
      </div>
      <Button size="sm" onClick={onSignIn}>
        Sign in
      </Button>
    </Alert>
  );
}
