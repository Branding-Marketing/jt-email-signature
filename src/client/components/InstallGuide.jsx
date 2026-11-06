import React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StepBadge } from "@/components/StepBadge";

const GUIDES = [
  {
    id: "outlook-classic",
    label: "Outlook (classic)",
    steps: ["Open File → Options → Mail → Signatures.", "Click New, name it “J&T”, then paste with Ctrl/Cmd + V.", "Choose it for new messages and replies, then click OK."],
  },
  {
    id: "outlook-new",
    label: "New Outlook / web",
    steps: ["Open Settings (gear icon) → Accounts → Signatures.", "Click New signature, name it, then paste into the editor.", "Pick it as the default for new messages and replies, then Save."],
  },
  {
    id: "gmail",
    label: "Gmail",
    steps: ["Open Settings (gear icon) → See all settings.", "In General → Signature, click Create new and paste.", "Choose it under Signature defaults, then Save Changes at the bottom."],
  },
];

export function InstallGuide({ className }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StepBadge>4</StepBadge>Install it
        </CardTitle>
        <CardDescription>About one minute, then every email you send uses it.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={GUIDES[0].id}>
          <TabsList className="max-w-full overflow-x-auto">
            {GUIDES.map((g) => (
              <TabsTrigger key={g.id} value={g.id}>
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {GUIDES.map((g) => (
            <TabsContent key={g.id} value={g.id} className="mt-2 grid gap-2.5 sm:grid-cols-3">
              {g.steps.map((step, i) => (
                <div key={i} className="rounded-lg border p-3 text-sm leading-relaxed">
                  <span className="mb-1.5 grid size-5 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">{i + 1}</span>
                  {step}
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
        <p className="mt-3 text-xs text-muted-foreground">Banner links only work in the copied signature, not in PNG images.</p>
      </CardContent>
    </Card>
  );
}
