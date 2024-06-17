import { GetGraphIntersectionResponse } from "../../../lib/types";
import { IntersectionPillView } from "./IntersectionPillView";

export function ResultsView({
  results,
  children,
}: {
  results: GetGraphIntersectionResponse;
  children: React.ReactNode;
}) {
  const allFidsInput =
    results.intersectionByDepth["0"] +
    results.intersectionByDepth["1"] +
    results.nonIntersectingCount;
  const degree2FidsIntersection =
    results.intersectionByDepth["0"] + results.intersectionByDepth["1"];
  const degree1FidsIntersection = results.intersectionByDepth["0"];

  const degree2Fids =
    results.linksByDepthCounts["0"] + results.linksByDepthCounts["1"];
  const degree1Fids = results.linksByDepthCounts["0"];

  const allFids = results.fidCount - degree2Fids;
  return (
    <div tw="flex p-10 text-[58px] bg-[#17101F] text-[#A0A3AF] w-full h-full justify-center items-center">
      <div tw="flex flex-col">
        <div tw="flex items-center mt-[160px] justify-center">
          <IntersectionPillView
            count1={allFidsInput}
            count2={degree2FidsIntersection}
            count3={degree1FidsIntersection}
          />
          <div tw="ml-4 text-[#A0A3AF] flex">{children}</div>
        </div>
        <div tw="flex text-[40px] justify-center items-center mt-[60px]">
          <IntersectionPillView
            count1={allFids}
            count2={degree2Fids}
            count3={degree1Fids}
          />
          <div tw="ml-4 text-[#A0A3AF] flex">total</div>
        </div>
      </div>
    </div>
  );
}
