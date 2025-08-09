import { frames } from "@/app/tutorial/frames";
import { redirect } from "next/navigation";

import { TutorialBoard } from "@/app/tutorial/tutorial-board";
import { LatestMoveProvider } from "@/components/LatestMoveContext";

export async function generateStaticParams() {
  return frames;
}

export default async function Page({ params }: any) {
  const frame = (await params).frame;

  const tutorialFrame = frames.find((i) => i.slugWithIndex === frame)!;

  const index = frames.indexOf(tutorialFrame);

  if (!tutorialFrame) {
    redirect("/");
  }

  const next = frames[index + 1]?.slugWithIndex || false;
  const prev = index > 0 ? frames[index - 1]?.slugWithIndex : false;

  const nextLink = `/tutorial/${next}`;
  const prevLink = `/tutorial/${prev}`;
  
  return (
    <div className="max-w-4xl mx-auto pt-8 xs:text-left sm:text-center">
      <LatestMoveProvider key={tutorialFrame.slugWithIndex}>
        <TutorialBoard 
          slug={tutorialFrame.slug} 
          nextLink={nextLink}
          prev={prev || undefined}
          next={next || undefined}
        />
      </LatestMoveProvider>
    </div>
  );
}
