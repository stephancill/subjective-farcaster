import { error } from "frames.js/core";
import { APP_URL } from "../../../lib/const";
import { graphIntesectionFrame } from "../../../lib/frames";
import { frames } from "../frames";
import { castEndpointCacheKey } from "../../../lib/utils";

const handler = frames(async (ctx) => {
  const hash = ctx.searchParams.hash;
  const fid = ctx.searchParams.fid;

  const viewerFid = ctx.message?.requesterFid;

  if (!hash || !fid || !viewerFid) {
    return error("Missing hash or fid or viewerFid");
  }

  return graphIntesectionFrame({
    fetchIntersectionUrl: `${APP_URL}/cast?hash=${hash}&fid=${fid}&viewerFid=${viewerFid}`,
    intersectionName: "likes",
    refreshButtonTarget: `/cast?fid=${fid}&hash=${hash}`,
    cacheKey: castEndpointCacheKey({ fid: parseInt(fid), hash }, viewerFid),
  });
});

export const GET = handler;
export const POST = handler;
