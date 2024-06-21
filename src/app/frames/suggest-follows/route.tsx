import { UserDataType } from "@farcaster/hub-nodejs";
import { APP_URL } from "../../../lib/const";
import { frames } from "../frames";
import { kv } from "@vercel/kv";

function getSuggestFollowsPageKey(fid: number) {
  return `suggest-follows:${fid}:page`;
}

const handler = frames(async (ctx) => {
  if (!ctx.message) {
    return {
      image: (
        <div tw="flex flex-col bg-[#17101F] text-white w-full h-full text-[48px] items-center justify-center">
          <div style={{ fontWeight: 700 }} tw="flex text-[64px]">
            Subjective Farcaster
          </div>
          <div tw="flex mt-5">Discover new people to follow on Farcaster</div>
          <div tw="flex absolute top-[500px] text-[#9fa3af]">
            by @stephancill
          </div>
        </div>
      ),
      buttons: [
        {
          label: "See my suggested follows",
          action: "post",
          target: "/suggest-follows",
        },
        {
          label: "Learn more ↗︎",
          action: "post",
          target: "/",
        },
      ],
    };
  }

  const fid = ctx.message.requesterFid;
  let pageRaw: string | null = ctx.searchParams.page || null;

  if (!pageRaw) {
    pageRaw = await kv.get<string>(getSuggestFollowsPageKey(fid));
  }

  const page = parseInt(pageRaw || "0");

  const refreshButton = {
    label: "Refresh ⟳",
    action: "post",
    target: "/suggest-follows",
  } as const;

  const searchParams = new URLSearchParams();
  searchParams.set("viewerFid", fid.toString());
  searchParams.set("page", page.toString());
  searchParams.set("pageSize", "1");
  const url = new URL(`${APP_URL}/suggest-follows`);
  url.search = searchParams.toString();

  const result:
    | {
        usersToFollow: (Record<UserDataType, string> & {
          count: number;
          fid: number;
        })[];
      }
    | {
        status: string;
        jobs: Record<string, { status: { message: string } }>;
      } = await fetch(url).then((res) => res.json());

  if ("status" in result) {
    return {
      image: (
        <div tw="flex flex-col p-10 text-[58px] bg-[#17101F] text-white w-full h-full justify-center items-center">
          <div tw="flex">{result.status}</div>
          <div tw="flex flex-col mt-10 text-[40px]">
            {Object.entries(result.jobs).map(([name, job]) => (
              <div tw="flex" key={name}>
                {name}: {job.status.message}
              </div>
            ))}
          </div>
        </div>
      ),
      buttons: [refreshButton],
    };
  } else {
    const [user] = result.usersToFollow;

    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set("page", (page + 1).toString());
    nextSearchParams.set("pageSize", "1");

    kv.set(`suggest-follows:${fid}:page`, page.toString());

    const backButton = {
      label: "← Back",
      action: "post",
      target: {
        pathname: "/suggest-follows",
        query: {
          page: page - 1,
          pageSize: 1,
        },
      },
    } as const;

    const nextButton = {
      label: "Next →",
      action: "post",
      target: {
        pathname: "/suggest-follows",
        query: {
          page: page + 1,
          pageSize: 1,
        },
      },
    } as const;

    const followButton = {
      label: "Follow",
      action: "link",
      target: `https://warpcast.com/${user[UserDataType.USERNAME]}`,
    } as const;

    const buttons =
      page === 0
        ? [followButton, nextButton]
        : [backButton, followButton, nextButton];

    return {
      image: (
        <div tw="flex flex-col bg-[#17101F] text-white w-full h-full text-[48px]">
          {user ? (
            <div tw="flex flex-col px-20 pt-10">
              <div tw="flex text-[#9fa3af] mb-5">#{page}</div>
              <div tw="flex flex-row mb-5">
                {user[UserDataType.PFP] && (
                  <img
                    style={{ border: "solid 2px #322D3C", objectFit: "cover" }}
                    tw="w-[140px] h-[140px] rounded-full mr-4 mt-3"
                    src={user[UserDataType.PFP]}
                  ></img>
                )}
                <div tw="flex flex-col">
                  <div style={{ fontWeight: 700 }} tw="flex">
                    {user[UserDataType.DISPLAY]}
                  </div>
                  <div tw="flex text-[#9fa3af]">
                    @{user[UserDataType.USERNAME]}
                  </div>
                  <div tw="flex mt-[20px] h-[170px] w-[820px] overflow-hidden">
                    {user[UserDataType.BIO]}
                  </div>
                </div>
              </div>
              <div tw="flex absolute top-[480px] w-[1200px] pl-20 text-[#9fa3af]">
                Followed by {user.count.toLocaleString()} users in your network
              </div>
            </div>
          ) : (
            <div>You've reached the end :&rpar;</div>
          )}
        </div>
      ),
      buttons,
    };
  }
});

export const GET = handler;
export const POST = handler;
