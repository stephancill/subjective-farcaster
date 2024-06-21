import { HubRpcClient } from "@farcaster/hub-nodejs";
import {
  ReactionType,
  UserDataType,
  base58ToBytes,
  isLinkAddMessage,
  isLinkCompactStateMessage,
  isReactionAddMessage,
  isUserDataAddMessage,
  reactionTypeToJSON,
} from "@farcaster/hub-web";
import { kv } from "@vercel/kv";
import { Queue } from "bullmq";
import fastq from "fastq";
import { createPublicClient, http, parseAbi } from "viem";
import { optimism } from "viem/chains";
import { HUB_URL, POPULATE_NETWORK_JOB_NAME } from "./const";
import { getAllMessagesFromHubEndpoint } from "./paginate";
import * as paginateRpc from "./paginate-rpc";
import { SerializedNetwork } from "./types";

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

export async function findJobPosition(jobId: string, queue: Queue) {
  const waitingJobs = await queue.getWaiting();
  const position = waitingJobs.findIndex((job) => job.id === jobId);

  return position !== -1 ? position : null;
}

export async function ensureNetworkViaJob(fid: number, queue: Queue) {
  const networkCacheKey = getNetworkByFidKey(fid);
  const networkJobId = getPopulateNetworkJobId(fid);

  const [viewerNetworkSerialized, networkJob, positionInQueue] =
    await Promise.all([
      kv.get<SerializedNetwork>(networkCacheKey),
      queue.getJob(networkJobId),
      findJobPosition(networkJobId, queue),
    ]);

  // Add jobs to queue
  await Promise.all([
    queue.add(
      POPULATE_NETWORK_JOB_NAME,
      {
        fid,
      },
      {
        jobId: networkJobId,
      }
    ),
  ]);

  const jobDescriptor = {
    [`Wider network of !${fid}`]: {
      status:
        networkJob?.progress ||
        (positionInQueue
          ? `Position in queue: ${positionInQueue}`
          : "Not queued"),
    },
  };

  return { viewerNetworkSerialized, jobDescriptor, networkJob } as const;
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
  network: ReturnType<typeof deserializeNetwork>,
  fids: number[]
) {
  let startTime = Date.now();
  const { allLinks, linksByDepth, linksByDepthCounts } = network;
  startTime = Date.now();

  const intersectionFids = fids.filter((fid) => {
    // console.log(`Checking intersection ${j++}/${fids.length}`);
    return allLinks.has(fid);
  });

  startTime = Date.now();

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

export function deserializeNetwork(
  network: SerializedNetwork,
  options: {
    minOccurrances?: number;
  } = {
    minOccurrances: 2,
  }
) {
  const allLinks = new Set<number>();
  const linksByDepth = Object.entries(network.linksByDepth).reduce(
    (acc, [depth, fids]) => {
      acc[parseInt(depth)] = new Set<number>();

      fids.forEach((fid) => {
        if (
          !options?.minOccurrances ||
          network.popularityByFid[fid] >= options.minOccurrances
        ) {
          // Add to allLinks
          allLinks.add(fid);
          // Convert to Set
          acc[parseInt(depth)].add(fid);
        }
      });
      return acc;
    },
    {} as Record<number, Set<number>>
  );

  const linksByDepthCounts = Object.entries(linksByDepth).reduce(
    (acc, [depth, fids]) => {
      acc[parseInt(depth)] = fids.size;
      return acc;
    },
    {} as Record<number, number>
  );

  return { allLinks, ...network, linksByDepth, linksByDepthCounts };
}

export async function getNetworkByFid(
  fid: number,
  {
    onProgress = () => {},
    forceRefresh,
  }: {
    onProgress?: (message: string) => void;
    forceRefresh?: boolean;
  }
) {
  let startTime = Date.now();

  const cacheKey = getNetworkByFidKey(fid);
  const cached = await kv.get<SerializedNetwork>(cacheKey);
  if (cached && !forceRefresh) {
    return deserializeNetwork(cached);
  }

  // Breadth-first search to get all links up to N levels deep using getAllLinksByFid
  const allLinks = new Set<number>();
  const linksByDepth: Record<number, Set<number>> = {};
  const occurrancesByFid: Record<number, number> = {};
  let linksToIndex = new Set<number>([fid]);
  let depth = 0;
  const MAX_DEPTH = 3;

  while (depth < MAX_DEPTH && linksToIndex.size > 0) {
    /**
     * This loop gets links for each fid in linksToIndex, and then adds them to nextLinks
     */

    onProgress(`Searching ${linksToIndex.size} links at depth ${depth}`);

    const nextLinks = new Array<number[]>();
    linksByDepth[depth] = new Set();
    const linksToIndexArray = Array.from(linksToIndex);

    /** Fetch cached links and then fetch remaining */

    const uncachedLinks: number[] = [];

    // Get existing links for fids from cache
    let startTime = Date.now();
    const linksToSearchResults = await kv.mget<(number[] | null)[]>(
      linksToIndexArray.map(getAllLinksByFidKey)
    );
    console.log(`kv.mget ${Date.now() - startTime}ms`);

    // Index fids
    linksToIndexArray.forEach((link, idx) => {
      // If it's the first time we've seen this link, index it in linksByDepth
      if (!allLinks.has(link)) {
        linksByDepth[depth].add(link);
      } else {
      }

      allLinks.add(link);

      // If we have cached links, add them to nextLinks, otherwise add to remaining
      if (linksToSearchResults[idx]) {
        nextLinks.push(linksToSearchResults[idx] as number[]);
      } else {
        uncachedLinks.push(link);
      }
    });

    // If we're at the last depth, don't fetch any more links
    if (depth === MAX_DEPTH - 1) {
      depth++;
      break;
    }

    onProgress(
      `Populating ${uncachedLinks.length} uncached links at depth ${depth}`
    );

    // Fetch links worker
    let completed = 0;
    const queue = fastq.promise(async (fid: number) => {
      const startTime = Date.now();
      const result = await getAllLinksByFid(fid, { hubUrl: HUB_URL });
      nextLinks.push(result);
      completed += 1;
      const duration = Date.now() - startTime;
      if (completed % 200 === 0)
        onProgress(
          `Populated uncached links at depth ${depth}: ${completed.toLocaleString()}/${uncachedLinks.length.toLocaleString()} ${
            Math.round((duration / 1000) * 100) / 100
          }s`
        );
    }, 50);

    // Populate fetch links worker queue
    startTime = Date.now();
    for (const fid of uncachedLinks) {
      queue.push(fid);
    }

    // Wait for all links to be fetched
    await queue.drained();

    onProgress(
      `Populated uncached links at depth ${depth}: ${uncachedLinks.length} ${
        Math.round(((Date.now() - startTime) / 1000) * 100) / 100
      }s`
    );

    linksToIndex = new Set<number>();

    startTime = Date.now();

    // j = 0;
    for (const links of nextLinks) {
      links.forEach((fid) => {
        linksToIndex.add(fid);

        // Count occurrances of each fid
        if (!occurrancesByFid[fid]) {
          occurrancesByFid[fid] = 0;
        }
        occurrancesByFid[fid] += 1;
      });
    }

    console.log(`Processing nextLinks ${Date.now() - startTime}ms`);

    depth++;
  }

  const linksByDepthArrays = Object.entries(linksByDepth).reduce(
    (acc, [k, v]) => {
      acc[parseInt(k)] = Array.from(v);
      return acc;
    },
    {} as Record<number, number[]>
  );

  onProgress(`Caching network for viewerFid ${fid}`);

  await kv.set(
    cacheKey,
    { linksByDepth: linksByDepthArrays, popularityByFid: occurrancesByFid },
    { ex: 60 * 60 * 24 }
  );

  onProgress(`Done`);

  return { allLinks, linksByDepth, popularityByFid: occurrancesByFid };
}

export async function getAllLinksByFid(
  fid: number,
  {
    hubUrl,
    hubClient,
  }:
    | { hubUrl: string; hubClient?: never }
    | { hubUrl?: never; hubClient: HubRpcClient }
) {
  const cacheKey = getAllLinksByFidKey(fid);

  const cached = await kv.get<number[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const linksMessages = hubUrl
    ? await getAllMessagesFromHubEndpoint({
        endpoint: "/v1/linksByFid",
        hubUrl,
        params: {
          fid: fid.toString(),
        },
        limit: 3000,
      })
    : await paginateRpc.getAllLinksByFid({ fid }, hubClient!);

  const linksSet = new Set<number>();

  linksMessages.forEach((linkMessage) =>
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
  const reactions = await getAllMessagesFromHubEndpoint({
    endpoint: "/v1/reactionsByCast",
    params: {
      target_fid: castId.fid.toString(),
      target_hash: castId.hash,
      reaction_type: reactionTypeToJSON(ReactionType.LIKE),
    },
    hubUrl,
  });

  console.log(`Got ${reactions.length} reaction messages`);

  const fids = reactions.filter(isReactionAddMessage).map((r) => r.data.fid);

  return fids;
}

export async function getAllLinksByTarget(
  fid: number,
  {
    hubUrl,
    hubClient,
    onProgress,
  }: (
    | { hubUrl: string; hubClient?: never }
    | { hubUrl?: never; hubClient: HubRpcClient }
  ) & { onProgress?: (message: string) => void }
) {
  const cacheKey = getAllLinksByTargetKey(fid);

  const cached = await kv.get<number[]>(cacheKey);
  if (cached) {
    console.log(`Cached ${cached.length} links for fid ${fid}`);
    return cached;
  }

  const linksMessages = hubUrl
    ? await getAllMessagesFromHubEndpoint({
        endpoint: "/v1/linksByTargetFid",
        params: {
          target_fid: fid.toString(),
          link_type: "follow",
        },
        hubUrl,
        debug: true,
        onProgress,
      })
    : await paginateRpc.getAllLinksByTarget({ fid }, hubClient!, onProgress);

  const linksSet = new Set<number>();

  linksMessages.forEach(
    (linkMessage) =>
      isLinkAddMessage(linkMessage) && linksSet.add(linkMessage.data.fid)
  );

  const linksArray = Array.from(linksSet);

  await kv.set(cacheKey, linksArray, {
    ex: 60 * 60 * 24, // 1 day
  });

  return linksArray;
}

export async function getUserDataByFid(
  fid: number,
  { hubUrl }: { hubUrl: string }
) {
  const userData = await getAllMessagesFromHubEndpoint({
    endpoint: "/v1/userDataByFid",
    hubUrl,
    params: {
      fid: fid.toString(),
    },
  });
  return userData.reduce((acc, message) => {
    if (!isUserDataAddMessage(message)) {
      return acc;
    }

    return {
      ...acc,
      [message.data.userDataBody.type]: message.data.userDataBody.value,
    };
  }, {} as Record<UserDataType, string>);
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
