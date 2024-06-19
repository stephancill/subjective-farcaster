import { error } from "frames.js/core";
import { APP_URL } from "../../../lib/const";
import { graphIntesectionFrame } from "../../../lib/frames";
import { frames } from "../frames";
import { getFollowersEndpointCacheKey } from "../../../lib/utils";

const handler = frames(async (ctx) => {
  const fid = ctx.searchParams.fid;
  const viewerFid = ctx.message?.requesterFid;

  if (!fid || !viewerFid) {
    return error("Missing hash or fid or viewerFid");
  }

  return graphIntesectionFrame({
    fetchIntersectionUrl: `${APP_URL}/followers?fid=${fid}&viewerFid=${viewerFid}`,
    intersectionName: "followers",
    refreshButtonTarget: `/followers?fid=${fid}`,
  });
});

export const GET = handler;
export const POST = handler;
