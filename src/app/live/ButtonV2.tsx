import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function Button({
  children,
  onClick,
  loadingText,
  size = "md",
}: Readonly<{
  children: React.ReactNode;
  onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  loadingText?: string;
  size?: "sm" | "md";
}>) {
  const [loading, setLoading] = useState(false);

  async function doOnClick(e: React.MouseEvent<HTMLButtonElement>) {
    setLoading(true);
    try {
      const result = onClick(e);
      if (result instanceof Promise) {
        await result;
      }
    } finally {
      setLoading(false);
    }
  }

  const _loadingText = loadingText || loading;

  return (
    <button
      className={cn(
        "bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 w-full border-2 border-blue-900 rounded",
        size === "sm" && "py-1 px-2 max-w-36 text-sm",
        size === "md" && "py-2 px-3 max-w-80 text-base"
      )}
      onClick={doOnClick}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {_loadingText}
        </div>
      ) : (
        children
      )}
    </button>
  );
}
