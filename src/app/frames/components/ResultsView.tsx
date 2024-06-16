import { getGraphIntersection } from "../../../lib/utils";

export function ResultsView({
  results,
  children,
}: {
  results: Awaited<ReturnType<typeof getGraphIntersection>>;
  children: React.ReactNode;
}) {
  const count1 =
    results.intersectionByDepth["0"] +
    results.intersectionByDepth["1"] +
    results.nonIntersectingCount;

  const count2 =
    results.intersectionByDepth["0"] + results.intersectionByDepth["1"];

  const count3 = results.intersectionByDepth["0"];

  return (
    <div tw="flex p-10 text-[58px] bg-[#17101F] text-[#A0A3AF] w-full h-full justify-center items-center">
      <div
        style={{ border: "dashed 6px #322D3C" }}
        tw="flex outline-dashed outline-green-500 outline-[#322D3C] rounded-full items-center pl-4 pr-2 py-2"
      >
        <div tw="flex mr-2 p-2">{count1.toLocaleString()}</div>
        <div tw="flex bg-[#322D3C] pl-4 pr-2 py-2 rounded-full">
          <div tw="flex mr-2 p-2">{count2.toLocaleString()}</div>
          <div tw="flex bg-[#484553] px-4 py-2 rounded-full">
            {count3.toLocaleString()}
          </div>
        </div>
      </div>
      <div tw="ml-4 text-[#A0A3AF]">{children}</div>
    </div>
  );
}
