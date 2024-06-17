import { Button } from "frames.js/next";
import { frames } from "./frames";
import { APP_URL } from "../../lib/const";

function constructCastActionUrl(params: { url: string }): string {
  const baseUrl = "https://warpcast.com/~/add-cast-action";
  const urlParams = new URLSearchParams({
    url: params.url,
  });

  return `${baseUrl}?${urlParams.toString()}`;
}

const handler = frames(async (ctx) => {
  return {
    image: (
      <div tw="flex p-10 text-[58px] bg-[#17101F] text-white w-full h-full justify-center items-center flex-col">
        <div tw="text-[52px] mb-4">Subjective Farcaster</div>
        <div tw="text-[36px]">
          Reaction and follow counts based on your social graph.
        </div>
      </div>
    ),
    buttons: [
      <Button
        action="link"
        target={constructCastActionUrl({
          url: `${APP_URL}/frames/actions/cast`,
        })}
      >
        Install Likes
      </Button>,
      <Button
        action="link"
        target={constructCastActionUrl({
          url: `${APP_URL}/frames/actions/followers`,
        })}
      >
        Install Followers
      </Button>,
    ],
  };
});

export const POST = handler;
export const GET = handler;
