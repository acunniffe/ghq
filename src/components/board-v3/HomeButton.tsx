import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

export default function HomeButton() {
  const router = useRouter();

  return (
    <Button
      className="bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex gap-1 items-center"
      onClick={() => router.push("/")}
    >
      🏠 Home
    </Button>
  );
}
