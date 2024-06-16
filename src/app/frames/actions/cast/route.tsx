import { NextRequest } from "next/server";
import { frames } from "../../frames";
import { APP_URL } from "../../../../lib/const";

type ActionMetadata = {
  /** The action name. Must be less than 30 characters. */
  name: string;
  /** An [Octicons](https://primer.style/foundations/icons) icon name. */
  icon: string;
  /** A short description up to 80 characters. */
  description: string;
  /** External link to an "about" page for extended description. */
  aboutUrl: string;
  /** The action type. (Same type options as frame buttons). Only post is accepted in V1. */
  action: {
    type: "post";
  };
};

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
