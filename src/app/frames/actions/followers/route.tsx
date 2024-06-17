import { NextRequest } from "next/server";
import { frames } from "../../frames";
import { APP_URL } from "../../../../lib/const";
import { ActionMetadata } from "frames.js";

export const GET = (req: NextRequest) => {
  const actionMetadata: ActionMetadata = {
    name: `Subjective Followers`,
    icon: "people",
    description: `Get your number of subjective followers for a user.`,
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
    frameUrl: `${APP_URL}/frames/followers?fid=${ctx.message?.castId?.fid}`,
  });
});
