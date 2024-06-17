import { kv } from "@vercel/kv";
import { FrameDefinition } from "frames.js/types";
import { getGraphIntersection } from "./utils";
import { ResultsView } from "../app/frames/components/ResultsView";
import { RESULT_CACHE_EX } from "./const";

export async function graphIntesectionFrame({
  fetchIntersectionUrl,
  intersectionName,
  refreshButtonTarget,
  cacheKey,
}: {
  refreshButtonTarget: string;
  intersectionName: string;
  fetchIntersectionUrl: string;
  cacheKey: string;
}): Promise<FrameDefinition<undefined>> {
  const refreshButton = {
    label: "Refresh ⟳",
    action: "post",
    target: refreshButtonTarget,
  } as const;

  // const cacheKey = `${intersectionName}:${fid}:${hash}:${viewerFid}`;

  const result = await kv.get<
    Awaited<ReturnType<typeof getGraphIntersection>> | { status: string }
  >(cacheKey);

  if (result && "status" in result) {
    return {
      image: (
        <div tw="flex p-10 text-[58px] bg-[#17101F] text-white w-full h-full justify-center items-center">
          {result.status}
        </div>
      ),
      buttons: [refreshButton],
    };
  } else if (result) {
    return {
      image: <ResultsView results={result}>{intersectionName}</ResultsView>,
    };
  }

  await kv.set(
    cacheKey,
    { status: "Loading..." },
    {
      ex: 60 * 60, // 1 hour
    }
  );

  fetch(fetchIntersectionUrl).then(async (res) => {
    if (!res.ok) {
      kv.set(
        cacheKey,
        { status: "Something went wrong, try again in 1 minute." },
        {
          ex: 60, // 1 minute
        }
      );
      return;
    }

    const data = await res.json();

    kv.set(cacheKey, data, {
      ex: RESULT_CACHE_EX, // 1 hour
    });
  });

  return {
    image: (
      <div tw="flex p-10 text-[58px] bg-[#17101F] text-white w-full h-full justify-center items-center">
        Loading...
      </div>
    ),
    buttons: [refreshButton],
  };
}
