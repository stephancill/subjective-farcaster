import { kv } from "@vercel/kv";
import { NextRequest } from "next/server";
import { HUB_URL, POPULATE_NETWORK_JOB_NAME } from "../../lib/const";
import { redis } from "../../lib/redis";
import { SerializedNetwork } from "../../lib/types";
import {
  deserializeNetwork,
  getNetworkByFidKey,
  getPopulateNetworkJobId,
  getUserDataByFid,
} from "../../lib/utils";
import { getQueue } from "../../lib/worker";

export async function GET(req: NextRequest) {
  const viewerFidRaw = req.nextUrl.searchParams.get("viewerFid");
  const forceRefresh = req.nextUrl.searchParams.get("forceRefresh") === "true";
  const page = parseInt(req.nextUrl.searchParams.get("page") || "0");
  const pageSize = parseInt(req.nextUrl.searchParams.get("limit") || "10");

  if (!viewerFidRaw) {
    return new Response("Missing viewerFid", { status: 400 });
  }

  const viewerFid = parseInt(viewerFidRaw);

  const queue = getQueue(redis);

  const networkCacheKey = getNetworkByFidKey(viewerFid);
  const networkJobId = getPopulateNetworkJobId(viewerFid);

  const [viewerNetworkSerialized, networkJob] = await Promise.all([
    kv.get<SerializedNetwork>(networkCacheKey),
    queue.getJob(networkJobId),
  ]);

  // Add jobs to queue
  await Promise.all([
    queue.add(
      POPULATE_NETWORK_JOB_NAME,
      {
        fid: viewerFid,
      },
      {
        jobId: networkJobId,
        priority: forceRefresh ? 1 : 100,
      }
    ),
  ]);

  if (!viewerNetworkSerialized) {
    return Response.json({
      jobs: {
        [`Wider network of !${viewerFid}`]: {
          status: networkJob?.progress || "Not started",
        },
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
