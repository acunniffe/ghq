"use client";

import * as React from "react";
import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";

export interface Settings {
  autoFlipBoard: boolean;
  undoWithMouse?: boolean;
}

type Checked = DropdownMenuCheckboxItemProps["checked"];

export default function SettingsMenu({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Pass and Play</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={settings.autoFlipBoard}
          onCheckedChange={(checked) =>
            setSettings({ ...settings, autoFlipBoard: !!checked })
          }
        >
          Automatic board flip
        </DropdownMenuCheckboxItem>
        <DropdownMenuLabel>Game</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={settings.undoWithMouse}
          onCheckedChange={(checked) =>
            setSettings({ ...settings, undoWithMouse: !!checked })
          }
        >
          Mouse 4/5 for undo/redo
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
