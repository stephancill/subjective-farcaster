import { NextRequest } from "next/server";
import { frames } from "../../frames";
import { APP_URL } from "../../../../lib/const";
import { ActionMetadata } from "frames.js";

export const GET = (req: NextRequest) => {
  const actionMetadata: ActionMetadata = {
    name: `Subjective Likes`,
    icon: "heart",
    description: `Get your number of subjective likes for a cast.`,
    aboutUrl: APP_URL,
    action: {
      type: "post",
    },
  };

  return Response.json(actionMetadata);
};

export const POST = frames(async (ctx) => {
  return Response.json({
    type: "frame",
    frameUrl: `${APP_URL}/frames/cast?hash=${ctx.message?.castId?.hash}&fid=${ctx.message?.castId?.fid}`,
  });
});
