import {
  Message,
  ReactionType,
  base58ToBytes,
  isLinkAddMessage,
  isLinkCompactStateMessage,
  isReactionAddMessage,
  reactionTypeToJSON,
} from "@farcaster/hub-web";
import { kv } from "@vercel/kv";
import fastq from "fastq";
import { createPublicClient, http, parseAbi } from "viem";
import { optimism } from "viem/chains";
import { getAllMessagesFromHubEndpoint } from "./paginate";

export function getPopulateNetworkJobId(fid: number) {
  return `refreshNetwork-${fid}`;
}

export function getPopulateFollowersJobId(fid: number) {
  return `populateFollowers-${fid}`;
}

export function getAllLinksByFidKey(fid: number) {
  return `linksByFid:${fid}`;
}

export function getAllLinksByTargetKey(fid: number) {
  return `linksByTarget:${fid}`;
}

export function getNetworkByFidKey(fid: number) {
  return `network:${fid}`;
}

export function getCastEndpointCacheKey(
  castId: { fid: number; hash: string },
  viewerFid: number
) {
  return `castEndpoint:${castId.fid}:${castId.hash}:${viewerFid}`;
}

export function getFollowersEndpointCacheKey(fid: number, viewerFid: number) {
  return `followersEndpoint:${fid}:${viewerFid}`;
}

export async function getFidCount() {
  const cached = await kv.get<number>("fidCount");
  if (cached) {
    return cached;
  }

  const client = createPublicClient({
    transport: http(),
    chain: optimism,
  });
  const fidCount = await client.readContract({
    abi: parseAbi(["function idCounter() view returns (uint256)"]),
    address: "0x00000000Fc6c5F01Fc30151999387Bb99A9f489b",
    functionName: "idCounter",
  });

  const fidCountNumber = Number(fidCount);

  kv.set("fidCount", fidCountNumber, {
    ex: 60 * 60 * 24, // 1 day
  });

  return fidCountNumber;
}

export async function getGraphIntersection(
  network: Awaited<ReturnType<typeof getNetworkByFid>>,
  fids: number[]
) {
  let startTime = Date.now();
  const { allLinks, linksByDepth } = network;
  startTime = Date.now();

  const intersectionFids = fids.filter((fid) => {
    // console.log(`Checking intersection ${j++}/${fids.length}`);
    return allLinks.has(fid);
  });

  startTime = Date.now();

  // Count network fids by depth
  const linksByDepthCounts = Object.entries(linksByDepth).reduce(
    (acc, [depth, fids]) => {
      acc[parseInt(depth)] = fids.size;
      return acc;
    },
    {} as Record<number, number>
  );

  const intersectionByDepth = Object.entries(linksByDepth).reduce(
    (acc, [depth, fids]) => {
      acc[parseInt(depth)] = Array.from(fids).filter((fid) =>
        intersectionFids.includes(fid)
      ).length;
      return acc;
    },
    {} as Record<number, number>
  );

  console.log(`Counting intersection by depth ${Date.now() - startTime}ms`);

  const nonIntersectingCount = fids.length - intersectionFids.length;

  return {
    allLinks,
    allLinksCount: allLinks.size,
    intersectionFids,
    intersectionCount: intersectionFids.length,
    intersectionByDepth,
    linksByDepth,
    linksByDepthCounts,
    nonIntersectingCount,
  };
}

export function deserializeNetwork(_linksByDepth: Record<number, number[]>) {
  const allLinks = new Set<number>();
  const linksByDepth = Object.entries(_linksByDepth).reduce(
    (acc, [depth, fids]) => {
      // Add to allLinks
      fids.forEach((fid) => allLinks.add(fid));
      // Convert to Set
      acc[parseInt(depth)] = new Set(fids);
      return acc;
    },
    {} as Record<number, Set<number>>
  );
  return { allLinks, linksByDepth };
}

export async function getNetworkByFid(
  fid: number,
  {
    hubUrl,
    onProgress = () => {},
    forceRefresh,
  }: {
    onProgress?: (message: string) => void;
    hubUrl: string;
    forceRefresh?: boolean;
  }
) {
  let startTime = Date.now();

  const cacheKey = getNetworkByFidKey(fid);
  const cached = await kv.get<{
    linksByDepth: Record<number, number[]>;
  }>(cacheKey);
  if (cached && !forceRefresh) {
    return deserializeNetwork(cached.linksByDepth);
  }

  onProgress(`Getting all links for viewerFid ${fid}`);

  const links = await getAllLinksByFid(fid, { hubUrl });

  console.log(`getAllLinksByFid ${Date.now() - startTime}ms`);

  // Breadth-first search to get all links up to N levels deep using getAllLinksByFid
  const allLinks = new Set<number>();
  const linksByDepth: Record<number, Set<number>> = {};
  let linksToSearch = new Set<number>(links);
  let i = 0;
  const N = 2;

  while (i < N && linksToSearch.size > 0) {
    onProgress(`Searching ${linksToSearch.size} links at depth ${i}`);

    const nextLinks = new Array<number[]>();
    linksByDepth[i] = new Set();
    const linksToSearchArray = Array.from(linksToSearch);
    let startTime = Date.now();
    const linksToSearchResults = await kv.mget<(number[] | null)[]>(
      linksToSearchArray.map(getAllLinksByFidKey)
    );

    console.log(`kv.mget ${Date.now() - startTime}ms`);

    const remaining = linksToSearchArray.filter((link, idx) => {
      if (!allLinks.has(link)) linksByDepth[i].add(link);

      allLinks.add(link);

      if (linksToSearchResults[idx]) {
        nextLinks.push(linksToSearchResults[idx] as number[]);
      }
      return !linksToSearchResults[idx];
    });

    onProgress(`Populating ${remaining.length} uncached links at depth ${i}`);

    let completed = 0;
    const queue = fastq.promise(async (fid: number) => {
      const result = await getAllLinksByFid(fid, { hubUrl });
      nextLinks.push(result);
      completed += 1;
      if (completed % 200 === 0)
        onProgress(
          `Populated uncached links at depth ${i}: ${completed.toLocaleString()}/${remaining.length.toLocaleString()}`
        );
    }, 100);

    for (const fid of remaining) {
      queue.push(fid);
    }

    await queue.drained();

    linksToSearch = new Set<number>();

    startTime = Date.now();

    // j = 0;
    for (const links of nextLinks) {
      // console.log(`Processing batch ${j++}/${nextLinks.length}`);
      links.forEach((l) => linksToSearch.add(l));
    }

    console.log(`Processing nextLinks ${Date.now() - startTime}ms`);

    i++;
  }

  const linksByDepthArrays = Object.entries(linksByDepth).reduce(
    (acc, [k, v]) => {
      acc[parseInt(k)] = Array.from(v);
      return acc;
    },
    {} as Record<number, number[]>
  );

  await kv.set(
    cacheKey,
    { linksByDepth: linksByDepthArrays },
    { ex: 60 * 60 * 24 }
  );

  return { allLinks, linksByDepth };
}

export async function getAllLinksByFid(
  fid: number,
  { hubUrl }: { hubUrl: string }
) {
  const cacheKey = getAllLinksByFidKey(fid);

  const cached = await kv.get<number[]>(cacheKey);
  if (cached) {
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

  await kv.set(cacheKey, linksArray, {
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

export async function getAllLinksByTarget(
  fid: number,
  {
    hubUrl,
    onProgress,
  }: { hubUrl: string; onProgress?: (message: string) => void }
) {
  const cacheKey = getAllLinksByTargetKey(fid);

  const cached = await kv.get<number[]>(cacheKey);
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
    onProgress,
  });

  const linksSet = new Set<number>();

  linksMessages
    .map((linkMessage) => Message.fromJSON(linkMessage))
    .forEach(
      (linkMessage) =>
        isLinkAddMessage(linkMessage) && linksSet.add(linkMessage.data.fid)
    );

  const linksArray = Array.from(linksSet);

  await kv.set(cacheKey, linksArray, {
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
