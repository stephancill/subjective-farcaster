import {
  CastId,
  FidRequest,
  HubResult,
  HubRpcClient,
  Message,
  MessagesResponse,
  ReactionType,
} from "@farcaster/hub-nodejs";
import { bytesToHex } from "viem";

const MAX_PAGE_SIZE = 10_000;

export async function getAllLinksByFid(
  fid: FidRequest,
  hubClient: HubRpcClient,
  onProgress?: (message: string) => void
) {
  const links: Message[] = new Array();
  let nextPageToken: Uint8Array | undefined;

  while (true) {
    const res = await hubClient.getLinksByFid({
      ...fid,
      pageSize: MAX_PAGE_SIZE,
      pageToken: nextPageToken,
    });

    const messages = checkMessages(res, fid.fid);
    links.push(...messages);

    if (messages.length < MAX_PAGE_SIZE) {
      break;
    }

    onProgress?.(`Got ${links.length} links`);

    nextPageToken = res._unsafeUnwrap().nextPageToken;
  }

  return links;
}

export async function getAllLinksByTarget(
  targetFid: FidRequest,
  hubClient: HubRpcClient,
  onProgress?: (message: string) => void
) {
  const links: Message[] = new Array();
  let nextPageToken: Uint8Array | undefined;

  while (true) {
    const res = await hubClient.getLinksByTarget({
      targetFid: targetFid.fid,
      pageSize: MAX_PAGE_SIZE,
      pageToken: nextPageToken,
    });

    const messages = checkMessages(res, targetFid.fid);
    links.push(...messages);

    onProgress?.(`Got ${links.length} links`);

    if (messages.length < MAX_PAGE_SIZE) {
      break;
    }

    nextPageToken = res._unsafeUnwrap().nextPageToken;
  }

  return links;
}

export async function getAllLikesByCast(
  castId: CastId,
  hubClient: HubRpcClient,
  onProgress?: (message: string) => void
) {
  const reactions: Message[] = new Array();
  let nextPageToken: Uint8Array | undefined;

  while (true) {
    const res = await hubClient.getReactionsByCast({
      targetCastId: castId,
      reactionType: ReactionType.LIKE,
      pageSize: MAX_PAGE_SIZE,
      pageToken: nextPageToken,
    });

    const messages = checkMessages(
      res,
      `cast: ${castId.fid} ${bytesToHex(castId.hash)}`
    );
    reactions.push(...messages);

    onProgress?.(`Got ${reactions.length} likes`);

    if (messages.length < MAX_PAGE_SIZE) {
      break;
    }

    nextPageToken = res._unsafeUnwrap().nextPageToken;
  }

  return reactions;
}

export function checkMessages(
  messages: HubResult<MessagesResponse>,
  id: string | number
) {
  if (messages.isErr()) {
    // This happens consistently for the same fids for an unknown reason, but still saves their relevant data
    console.log(messages.error, `Error fetching messages for ${id}`);
  }

  return messages.isOk() ? messages.value.messages : [];
}
