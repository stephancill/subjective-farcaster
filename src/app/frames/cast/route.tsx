import { kv } from "@vercel/kv";
import { error } from "frames.js/core";
import { getGraphIntersection } from "../../../lib/utils";
import { frames } from "../frames";
import { APP_URL } from "../../../lib/const";
import { ResultsView } from "../components/ResultsView";

const handler = frames(async (ctx) => {
  const hash = ctx.searchParams.hash;
  const fid = ctx.searchParams.fid;

  const viewerFid = ctx.message?.requesterFid;

  if (!hash || !fid || !viewerFid) {
    return error("Missing hash or fid or viewerFid");
  }

  const refreshButton = {
    label: "Refresh ⟳",
    action: "post",
    target: { pathname: "/cast", query: { hash, fid } },
  } as const;

  const cacheKey = `cast:${fid}:${hash}:${viewerFid}`;

  const result = await kv.get<
    Awaited<ReturnType<typeof getGraphIntersection>> | { status: string }
  >(cacheKey);

  if (result && "status" in result) {
    return {
      image: (
        <div tw="flex p-10 text-[58px] bg-[#17101F] text-[#A0A3AF] w-full h-full justify-center items-center">
          {result.status}
        </div>
      ),
      buttons: [refreshButton],
    };
  } else if (result) {
    return {
      image: <ResultsView results={result}>likes</ResultsView>,
    };
  }

  await kv.set(
    cacheKey,
    { status: "Loading..." },
    {
      ex: 60 * 60, // 1 hour
    }
  );

  fetch(`${APP_URL}/cast?hash=${hash}&fid=${fid}&viewerFid=${viewerFid}`).then(
    async (res) => {
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
        ex: 60, // 1 minute
      });
    }
  );

  return {
    image: (
      <div tw="flex p-10 text-[58px] bg-[#17101F] text-[#A0A3AF] w-full h-full justify-center items-center">
        Loading...
      </div>
    ),
    buttons: [refreshButton],
  };
});

export const GET = handler;
export const POST = handler;
