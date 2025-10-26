import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

export default function HomeButton() {
  const router = useRouter();

  return (
    <Button variant="outline" onClick={() => router.push("/")}>
      🏠 Home
    </Button>
  );
}
