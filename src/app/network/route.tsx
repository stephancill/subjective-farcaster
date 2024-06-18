import { NextRequest } from "next/server";
import { getUserNetwork } from "../../lib/utils";
import { HUB_URL } from "../../lib/const";

export async function GET(req: NextRequest) {
  const viewerFid = req.nextUrl.searchParams.get("viewerFid");
  const forceRefresh = req.nextUrl.searchParams.get("forceRefresh") === "true";

  if (!viewerFid) {
    return new Response("Missing viewerFid", { status: 400 });
  }

  const { allLinks, linksByDepth } = await getUserNetwork(parseInt(viewerFid), {
    hubUrl: HUB_URL,
    forceRefresh,
    onProgress(message) {
      console.log(message);
    },
  });

  return Response.json({
    allLinks: Array.from(allLinks),
    linksByDepth: Object.entries(linksByDepth).reduce((acc, [depth, links]) => {
      acc[depth] = Array.from(links);
      return acc;
    }, {} as Record<string, number[]>),
  });
}
