function getFirstTuesdayOfMonth(from: Date): Date {
  const year = from.getFullYear();
  const month = from.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysUntilTuesday = (2 - firstDay + 7) % 7;
  return new Date(year, month, 1 + daysUntilTuesday);
}

function getNextFirstTuesday(today: Date): Date {
  const currentMonthFirstTuesday = getFirstTuesdayOfMonth(today);

  if (currentMonthFirstTuesday < today) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return getFirstTuesdayOfMonth(nextMonth);
  }

  return currentMonthFirstTuesday;
}

export function GHQNight() {
  // const today = new Date(2025, 10, 3); // for testing
  const today = new Date();
  const targetDate = getNextFirstTuesday(today);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;

  const getDaysUntil = () => {
    if (diffDays === 0) return "today!";
    if (diffDays === 1) return "tomorrow";
    return `in ${diffDays} days`;
  };

  return (
    <div className="p-3 flex flex-col gap-2 text-white bg-blue-500 rounded">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <div className="text-lg font-bold">GHQ Tuesday 🪖 💣 💥</div>
          <div className="text-right flex items-end gap-1">
            <div className="font-bold">8-10pm ET</div>
            <div className="text-sm">{getDaysUntil()}</div>
          </div>
        </div>
        <div className="text-sm">
          <div>⭐ Play Rapid games with someone new</div>
          <div>
            ⭐ Chat with players on{" "}
            <a
              className="text-blue-100 hover:text-blue-200 underline decoration-blue-100"
              href="https://discord.gg/MDaTYTdG5e"
              target="_blank"
            >
              Discord
            </a>
          </div>

          <div>
            ⭐ Live on Twitch{" "}
            <a
              className="text-blue-100 hover:text-blue-200 underline decoration-blue-100"
              href="https://twitch.tv/tylerghq"
              target="_blank"
            >
              @TylerGHQ
            </a>{" "}
            teaching and playing
          </div>
        </div>
      </div>
    </div>
  );
}
