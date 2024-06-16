import { getAllMessagesFromHubEndpoint } from "./paginate";
import {
  Message,
  ReactionType,
  isLinkAddMessage,
  isLinkCompactStateMessage,
  isReactionAddMessage,
  reactionTypeToJSON,
} from "@farcaster/hub-web";
import { kv } from "@vercel/kv";
import { base58ToBytes } from "@farcaster/hub-web";

export function chunkArray<T>(array: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
export function formatAllLinksByFidKey(fid: number) {
  return `linksByFid:${fid}`;
}

export async function getGraphIntersection(
  _viewerFid: number,
  hubUrl: string,
  fids: number[]
) {
  const links = await getAllFollowingByFid(_viewerFid, { hubUrl });

  // Breadth-first search to get all links up to N levels deep using getAllLinksByFid
  const allLinks = new Set<number>();
  const linksByDepth: Record<number, Set<number>> = {};
  let linksToSearch = new Set<number>(links);
  let i = 0;
  const N = 2;

  while (i < N && linksToSearch.size > 0) {
    console.log(`Level ${i} with ${linksToSearch.size} links`);
    const nextLinks = new Array<number[]>();
    linksByDepth[i] = new Set();
    const linksToSearchArray = Array.from(linksToSearch);
    const linksToSearchResults = await kv.mget<(number[] | null)[]>(
      linksToSearchArray.map(formatAllLinksByFidKey)
    );

    console.log(
      `Got linksToSearchResults: ${
        linksToSearchResults.filter(Boolean).length
      }/${linksToSearchArray.length}`
    );

    const remaining = linksToSearchArray.filter((link, idx) => {
      if (!allLinks.has(link)) linksByDepth[i].add(link);

      allLinks.add(link);

      if (linksToSearchResults[idx]) {
        nextLinks.push(linksToSearchResults[idx] as number[]);
      }
      return !linksToSearchResults[idx];
    });

    console.log(`Remaining links to search: ${remaining.length}`);

    const batchSize = 100;
    const batches = chunkArray(remaining, batchSize);

    let j = 0;
    for (const batch of batches) {
      const results = await Promise.all(
        batch.map((link) => getAllFollowingByFid(link, { hubUrl }))
      );

      results.forEach((result) => nextLinks.push(result));

      console.log(
        `Progress: ${j * batchSize + results.length}/${remaining.length}`
      );
      j++;
    }

    linksToSearch = new Set<number>();

    j = 0;
    for (const links of nextLinks) {
      console.log(`Processing batch ${j++}/${nextLinks.length}`);
      links.forEach((l) => linksToSearch.add(l));
    }

    i++;
  }

  // Get intersection of network and target fids
  let j = 0;
  const intersectionFids = fids.filter((fid) => {
    console.log(`Checking intersection ${j++}/${fids.length}`);
    return allLinks.has(fid);
  });

  // Count network fids by depth
  const linksByDepthCounts = Object.entries(linksByDepth).reduce(
    (acc, [depth, fids]) => {
      acc[parseInt(depth)] = fids.size;
      return acc;
    },
    {} as Record<number, number>
  );

  return { allLinks, intersectionFids, linksByDepth, linksByDepthCounts };
}

export async function getAllFollowingByFid(
  fid: number,
  { hubUrl }: { hubUrl: string }
) {
  const key = formatAllLinksByFidKey(fid);

  const cached = await kv.get<number[]>(key);
  if (cached) {
    // console.log(`Cached links for fid ${fid}`);
    return cached;
  }

  const linksMessages: unknown[] = await getAllMessagesFromHubEndpoint({
    endpoint: "/v1/linksByFid",
    hubUrl,
    params: {
      fid: fid.toString(),
    },
    limit: 3000,
  });

  const linksSet = new Set<number>();

  linksMessages
    .map((linkMessage) => Message.fromJSON(linkMessage))
    .forEach((linkMessage) =>
      isLinkAddMessage(linkMessage) && linkMessage.data.linkBody.targetFid
        ? linksSet.add(linkMessage.data.linkBody.targetFid)
        : isLinkCompactStateMessage(linkMessage)
        ? linkMessage.data.linkCompactStateBody.targetFids.forEach((t) =>
            linksSet.add(t)
          )
        : null
    );

  const linksArray = Array.from(linksSet);

  await kv.set(key, linksArray, {
    ex: 60 * 60 * 24, // 1 day
  });

  return linksArray;
}

export async function getAllLikersByCast(
  castId: { fid: number; hash: string },
  { hubUrl }: { hubUrl: string }
) {
  const reactionMessagesJson: unknown[] = await getAllMessagesFromHubEndpoint({
    endpoint: "/v1/reactionsByCast",
    params: {
      target_fid: castId.fid.toString(),
      target_hash: castId.hash,
      reaction_type: reactionTypeToJSON(ReactionType.LIKE),
    },
    hubUrl,
  });

  const reactions = reactionMessagesJson.map((reactionMessage) =>
    Message.fromJSON(reactionMessage)
  );

  console.log(`Got ${reactions.length} reaction messages`);

  const fids = reactions.filter(isReactionAddMessage).map((r) => r.data.fid);

  return fids;
}

export async function getAllFollowersByFid(
  fid: number,
  { hubUrl }: { hubUrl: string }
) {
  const key = `followersByFid:${fid}`;

  const cached = await kv.get<number[]>(key);
  if (cached) {
    console.log(`Cached ${cached.length} links for fid ${fid}`);
    return cached;
  }

  const linksMessages: unknown[] = await getAllMessagesFromHubEndpoint({
    endpoint: "/v1/linksByTargetFid",
    params: {
      target_fid: fid.toString(),
      link_type: "follow",
    },
    hubUrl,
    debug: true,
  });

  console.log(`Got ${linksMessages.length} links for fid ${fid}`);

  const linksSet = new Set<number>();

  linksMessages
    .map((linkMessage) => Message.fromJSON(linkMessage))
    .forEach(
      (linkMessage) =>
        isLinkAddMessage(linkMessage) && linksSet.add(linkMessage.data.fid)
    );

  const linksArray = Array.from(linksSet);

  console.log(`Got ${linksArray.length} links for fid ${fid}`);
  await kv.set(key, linksArray, {
    ex: 60 * 60 * 24, // 1 day
  });

  return linksArray;
}

// Map of current key names to old key names that we want to preserve for backwards compatibility reasons
// If you are renaming a protobuf field, add the current name as the key, and the old name as the value, and we
// will copy the contents of the current field to the old field
const BACKWARDS_COMPATIBILITY_MAP: Record<string, string> = {
  verificationAddAddressBody: "verificationAddEthAddressBody",
  claimSignature: "ethSignature",
};

/**
 * The protobuf format specifies encoding bytes as base64 strings, but we want to return hex strings
 * to be consistent with the rest of the API, so we need to convert the base64 strings to hex strings
 * before returning them.
 */
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function transformHashReverse(objRaw: any): any {
  const obj = structuredClone(objRaw);

  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // These are the target keys that are base64 encoded, which should be converted to hex
  const toHexKeys = [
    "hash",
    "signer",
    "transactionHash",
    "key",
    "owner",
    "to",
    "from",
    "recoveryAddress",
  ];

  // Convert these target keys to strings
  const toStringKeys = ["name"];

  const toHexOrBase58Keys = ["address", "blockHash"];

  for (const key in obj) {
    // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
    if (obj.hasOwnProperty(key)) {
      if (toHexKeys.includes(key) && typeof obj[key] === "string") {
        // obj[key] = convertB64ToHex(obj[key]);
        // Reverse: convert hex to base64
        obj[key] = Buffer.from(obj[key].slice(2), "hex").toString("base64");
      } else if (toStringKeys.includes(key) && typeof obj[key] === "string") {
        // obj[key] = Buffer.from(obj[key], "base64").toString("utf-8");
        // Reverse: convert string to base64
        obj[key] = Buffer.from(obj[key]).toString("base64");
      } else if (
        toHexOrBase58Keys.includes(key) &&
        typeof obj[key] === "string"
      ) {
        // We need to convert solana related bytes to base58
        if (obj["protocol"] === "PROTOCOL_SOLANA") {
          // obj[key] = convertB64ToB58(obj[key]);
          // Reverse: convert base58 to base64
          obj[key] = Buffer.from(
            base58ToBytes(obj[key]).unwrapOr(new Uint8Array())
          ).toString("base64");
        } else {
          // obj[key] = convertB64ToHex(obj[key]);
          // Reverse: convert hex to base64
          obj[key] = Buffer.from(obj[key].slice(2), "hex").toString("base64");
        }
      } else if (typeof obj[key] === "object") {
        obj[key] = transformHashReverse(obj[key]);
      }

      const backwardsCompatibleName = BACKWARDS_COMPATIBILITY_MAP[key];
      if (backwardsCompatibleName) {
        obj[backwardsCompatibleName] = obj[key];
      }
    }
  }

  return obj;
}
