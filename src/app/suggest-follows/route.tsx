import { NextRequest } from "next/server";
import { HUB_URL } from "../../lib/const";
import { redis } from "../../lib/redis";
import {
  deserializeNetwork,
  ensureNetworkViaJob,
  getUserDataByFid,
} from "../../lib/utils";
import { getNetworkQueue } from "../../lib/worker";

export async function GET(req: NextRequest) {
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");
  const forceRefresh = req.nextUrl.searchParams.get("forceRefresh") === "true";
  const page = parseInt(req.nextUrl.searchParams.get("page") || "0");
  const pageSize = parseInt(req.nextUrl.searchParams.get("limit") || "10");

  if (!viewerFidRaw) {
    return new Response("Missing viewerFid", { status: 400 });
  }

  const viewerFid = parseInt(viewerFidRaw);

  const queue = getNetworkQueue(redis);

  const { viewerNetworkSerialized, jobDescriptor, networkJob } =
    await ensureNetworkViaJob(viewerFid, queue);

  if (!viewerNetworkSerialized) {
    return Response.json({
      jobs: {
        ...jobDescriptor,
      },
      status: networkJob?.progress ? "In progress" : "Not started",
    });
  }

  const { linksByDepth, popularityByFid } = deserializeNetwork(
    viewerNetworkSerialized
  );

  const fidsWithCountsNotFollowed = Object.entries(popularityByFid)
    .filter(([fid]) => {
      return (
        !linksByDepth["1"].has(parseInt(fid)) &&
        !linksByDepth["0"].has(parseInt(fid))
      );
    })
    .sort((a, b) => b[1] - a[1])
    .slice(pageSize * page, pageSize * page + 1);

  const userProfiles = await Promise.all(
    fidsWithCountsNotFollowed.map(([fid]) =>
      getUserDataByFid(parseInt(fid), { hubUrl: HUB_URL })
    )
  );

  const usersToFollow = userProfiles.map((profile, i) => ({
    ...profile,
    count: fidsWithCountsNotFollowed[i][1],
    fid: fidsWithCountsNotFollowed[i][0],
  }));

  return Response.json({
    usersToFollow,
  });
}
