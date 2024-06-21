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
    results.intersectionByDepth["1"] +
    results.intersectionByDepth["2"] +
    results.nonIntersectingCount;
  const degree2FidsIntersection =
    results.intersectionByDepth["1"] + results.intersectionByDepth["2"];
  const degree1FidsIntersection = results.intersectionByDepth["1"];

  const degree2Fids =
    results.linksByDepthCounts["1"] + results.linksByDepthCounts["2"];
  const degree1Fids = results.linksByDepthCounts["1"];

  const allFids = results.fidCount - degree2Fids;
  return (
    <div tw="flex p-10 text-[58px] bg-[#17101F] text-[#A0A3AF] w-full h-full justify-center items-center">
      <div tw="flex flex-col absolute top-[0px] text-[48px] p-20 text-center">
        <div style={{ fontWeight: 700 }} tw="flex text-[64px]">
          Subjective Farcaster
        </div>
      </div>
      <div tw="flex flex-col">
        <div tw="flex items-center justify-center">
          <IntersectionPillView
            count1={allFidsInput.toLocaleString()}
            count2={degree2FidsIntersection.toLocaleString()}
            count3={degree1FidsIntersection.toLocaleString()}
          />
          <div tw="ml-4 text-[#A0A3AF] flex">{children}</div>
        </div>
      </div>
      <div tw="flex absolute top-[430px] text-[40px] justify-center items-center">
        <IntersectionPillView
          count1={allFids.toLocaleString()}
          count2={degree2Fids.toLocaleString()}
          count3={degree1Fids.toLocaleString()}
        />
        <div tw="ml-4 text-[#A0A3AF] flex">your network</div>
      </div>
    </div>
  );
}
