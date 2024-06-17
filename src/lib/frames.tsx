import { kv } from "@vercel/kv";
import { FrameDefinition } from "frames.js/types";
import { ResultsView } from "../app/frames/components/ResultsView";
import { RESULT_CACHE_EX, STATUS_CACHE_EX } from "./const";
import { GetGraphIntersectionResponse } from "./types";

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

  console.log("cacheKey", cacheKey);
  const resultCacheKey = `${cacheKey}:result`;

  const [statusCache, resultCache] = await Promise.all([
    kv.get<{ status: string }>(cacheKey),
    kv.get<GetGraphIntersectionResponse>(resultCacheKey),
  ]);

  if (!resultCache && statusCache?.status) {
    return {
      image: (
        <div tw="flex p-10 text-[58px] bg-[#17101F] text-white w-full h-full justify-center items-center">
          {statusCache.status}
        </div>
      ),
      buttons: [refreshButton],
    };
  } else if (resultCache) {
    return {
      image: (
        <ResultsView results={resultCache}>{intersectionName}</ResultsView>
      ),
    };
  }

  const status = "Loading...";

  await kv.set(
    cacheKey,
    { status },
    {
      ex: STATUS_CACHE_EX, // 1 hour
    }
  );

  await kv.del(resultCacheKey);

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

    kv.set(resultCacheKey, data, {
      ex: RESULT_CACHE_EX, // 1 hour
    });
  });

  return {
    image: (
      <div tw="flex p-10 text-[58px] bg-[#17101F] text-white w-full h-full justify-center items-center">
        {status}
      </div>
    ),
    buttons: [refreshButton],
  };
}
