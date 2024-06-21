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
      <div tw="flex flex-col bg-[#17101F] text-white w-full h-full text-[48px] items-center justify-center p-20 text-center">
        <div style={{ fontWeight: 700 }} tw="flex text-[64px]">
          Subjective Farcaster
        </div>
        <div tw="flex mt-10">
          Reaction and follow counts based on your social graph.
        </div>
        <div tw="flex absolute top-[500px] text-[#9fa3af]">by @stephancill</div>
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
      <Button
        action="post"
        target={{
          pathname: "/suggest-follows",
        }}
      >
        Discover Users
      </Button>,
    ],
  };
});

export const POST = handler;
export const GET = handler;
