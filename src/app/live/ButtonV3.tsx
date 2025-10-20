import { cn } from "@/lib/utils";
import { Loader2, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Button({
  options,
  onClick,
  loadingText,
  size = "md",
}: Readonly<{
  options: Array<{ id: string; body: React.ReactNode }>;
  onClick: (
    id: string,
    e?: React.MouseEvent<HTMLButtonElement>
  ) => void | Promise<void>;
  loadingText?: string;
  size?: "sm" | "md";
}>) {
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState(options[0]);

  async function doOnClick(e: React.MouseEvent<HTMLButtonElement>) {
    setLoading(true);
    try {
      const result = onClick(selectedOption.id, e);
      if (result instanceof Promise) {
        await result;
      }
    } finally {
      setLoading(false);
    }
  }

  const _loadingText = loadingText || loading;

  return (
    <div
      className={cn(
        "flex w-full",
        size === "sm" && "max-w-36",
        size === "md" && "max-w-80"
      )}
    >
      <button
        className={cn(
          "bg-blue-600 hover:bg-blue-700 text-white flex-1 border-2 border-blue-900 rounded-l",
          size === "sm" && "py-1 px-2 text-sm",
          size === "md" && "py-2 px-3 text-base"
        )}
        onClick={doOnClick}
        disabled={loading}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {_loadingText}
          </div>
        ) : (
          selectedOption.body
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "bg-blue-600 hover:bg-blue-700 text-white border-2 border-l-0 border-blue-900 rounded-r flex items-center justify-center",
              size === "sm" && "py-1 px-2 w-8",
              size === "md" && "py-2 px-3 w-10"
            )}
            disabled={loading}
          >
            <ChevronDown
              className={cn(
                size === "sm" && "h-3 w-3",
                size === "md" && "h-4 w-4"
              )}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onClick={() => setSelectedOption(option)}
            >
              {option.body}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
