import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function useServerConnectionStatus({
  isServerConnected,
}: {
  isServerConnected: boolean | undefined;
}) {
  const disconnectToastId = useRef<string | number | undefined>(undefined);

  useEffect(() => {
    if (isServerConnected === false) {
      if (!disconnectToastId.current) {
        disconnectToastId.current = toast(
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>We&apos;re having trouble reaching the server...</span>
          </div>,
          {
            duration: Infinity,
          }
        );
      }
    } else if (isServerConnected === true) {
      if (disconnectToastId.current) {
        toast.dismiss(disconnectToastId.current);
        disconnectToastId.current = undefined;
      }
    }
  }, [isServerConnected]);

  return null;
}
