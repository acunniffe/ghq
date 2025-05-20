"use client";

import { useRouter } from "next/navigation";
import Button from "./live/ButtonV2";
import { PlayOnlineButton } from "./live/PlayOnlineButton";
import { Learn } from "@/components/Learn";
import Header from "@/components/Header";
import LiveGamesList from "./LiveGamesList";
import { GHQNight } from "@/components/GHQNight";
import CorrespondenceView from "./CorrespondenceView";
import PlayersTab from "./PlayersTab";
import { useState } from "react";
import { Star } from "lucide-react";
import { PlayDailyButton } from "./live/PlayDailyButton";

function App() {
  const router = useRouter();
  const [showVariants, setShowVariants] = useState(false);

  async function playLocal() {
    router.push("/local");
  }

  async function playBot() {
    router.push("/bot");
  }

  async function goLearn() {
    router.push("/learn");
  }

  async function startTutorial() {
    router.push("/tutorial/1-hq");
  }

  return (
    <div className="p-2 flex flex-col gap-4 lg:px-48">
      <Header />
      {/* <LatestMessage /> */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 bg-gray-300 gap-[1px]">
        <div className="col-span-1 flex flex-col gap-[1px] bg-gray-300">
          <div className="flex flex-col gap-2 p-4 border-black bg-white">
            <div
              className="flex items-center gap-2 font-bold text-lg cursor-pointer group"
              onClick={() => setShowVariants(!showVariants)}
            >
              Play a game
              <Star className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 place-items-center">
              <PlayDailyButton />
              <PlayOnlineButton mode="rapid" />
              <Button onClick={playBot}>🤖 Play Bot</Button>
              <Button onClick={playLocal}>👨‍💻 Pass n&apos; Play</Button>
              <Button onClick={startTutorial}>🙋‍♂️ Learn to Play</Button>
              <Button onClick={goLearn}>📚 Rules & Puzzles</Button>

              {showVariants && (
                <>
                  <PlayOnlineButton mode="blitz" />
                  <PlayOnlineButton mode="endgame" />
                  <PlayOnlineButton mode="normandy" />
                </>
              )}
            </div>
          </div>

          <div className="p-4 flex flex-col gap-2 bg-white">
            <Learn />
          </div>
          <div className="p-4 flex flex-col gap-2 bg-white">
            <CorrespondenceView />
          </div>
          <div className="p-4 flex flex-col gap-2 bg-white flex-1"></div>
        </div>

        <div className="col-span-1 flex flex-col gap-[1px] bg-gray-300">
          <GHQNight />
          <div className="p-4 bg-white">
            <PlayersTab />
          </div>
          <div className="p-4 bg-white flex-1">
            <LiveGamesList />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
