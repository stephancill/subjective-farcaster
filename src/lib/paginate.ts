import { FidRequest, OnChainEvent, SignerEventType } from "@farcaster/hub-web";

import { bytesToHex, decodeAbiParameters } from "viem";
import { transformHashReverse } from "./utils";

export const MAX_PAGE_SIZE = 1000;

export const signedKeyRequestAbi = [
  {
    components: [
      {
        name: "requestFid",
        type: "uint256",
      },
      {
        name: "requestSigner",
        type: "address",
      },
      {
        name: "signature",
        type: "bytes",
      },
      {
        name: "deadline",
        type: "uint256",
      },
    ],
    name: "SignedKeyRequest",
    type: "tuple",
  },
] as const;

export async function getAllMessagesFromHubEndpoint({
  endpoint,
  hubUrl,
  params,
  limit,
  debug,
}: {
  endpoint: string;
  hubUrl: string;
  params: Record<string, string>;
  limit?: number;
  debug?: boolean;
}) {
  const messages: unknown[] = new Array();
  let nextPageToken: string | undefined;

  while (true) {
    const _params = new URLSearchParams({
      pageSize: MAX_PAGE_SIZE.toString(),
    });

    for (const [key, value] of Object.entries(params)) {
      _params.append(key, value);
    }

    if (nextPageToken) {
      _params.append("pageToken", nextPageToken);
    }

    const url = `${hubUrl}${endpoint}?${_params}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch messages from ${url}`);
    }

    const { messages: resMessages, nextPageToken: _nextPageToken } =
      await res.json();

    nextPageToken = _nextPageToken;

    const transformedMessages = resMessages.map(transformHashReverse);

    messages.push(...transformedMessages);

    if (debug) {
      console.log(`Total messages ${messages.length} from ${url}`);
    }

    // Only fetch one page in development
    if (process.env.NEXT_PUBLIC_NODE_ENV === "development") {
      console.log(`Breaking after fetching one page from ${url}`);
      break;
    }

    if (
      resMessages.length < MAX_PAGE_SIZE ||
      (limit && messages.length >= limit)
    ) {
      // console.log(`Breaking after fetching ${messages.length} messages`);
      break;
    }
  }

  return messages;
}

export async function getAllCastsByFid(
  fid: FidRequest,
  { hubUrl }: { hubUrl: string }
) {
  const casts: unknown[] = await getAllMessagesFromHubEndpoint({
    endpoint: "/v1/castsByFid",
    params: {
      fid: fid.fid.toString(),
    },
    hubUrl,
  });

  return casts;
}

export async function getAllReactionsByFid(
  fid: FidRequest,
  { hubUrl }: { hubUrl: string }
) {
  const reactions: unknown[] = await getAllMessagesFromHubEndpoint({
    endpoint: "/v1/reactionsByFid",
    params: {
      fid: fid.fid.toString(),
    },
    hubUrl,
  });

  return reactions;
}

export async function getAllLinksByFid(
  fid: FidRequest,
  { hubUrl }: { hubUrl: string }
) {
  const links: unknown[] = await getAllMessagesFromHubEndpoint({
    endpoint: "/v1/linksByFid",
    params: {
      fid: fid.fid.toString(),
    },
    hubUrl,
  });

  return links;
}

export function decodeSignedKeyRequestMetadata(metadata: Uint8Array) {
  return decodeAbiParameters(signedKeyRequestAbi, bytesToHex(metadata))[0];
}

export async function getAllSignersByFid(
  fid: FidRequest,
  { hubUrl }: { hubUrl: string }
) {
  const events: unknown[] = new Array();
  let nextPageToken: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      fid: fid.fid.toString(),
      pageSize: MAX_PAGE_SIZE.toString(),
    });

    if (nextPageToken) {
      params.append("pageToken", nextPageToken);
    }

    const res = await fetch(`${hubUrl}/v1/onChainSignersByFid?${params}`);
    const { events: resEvents, ..._nextPageToken } = await res.json();

    nextPageToken = _nextPageToken;

    const transformedEvents = resEvents.map(transformHashReverse);

    for (const signerJson of transformedEvents) {
      const signer = OnChainEvent.fromJSON(signerJson);
      const body = signer.signerEventBody;
      const timestamp = new Date(signer.blockTimestamp * 1000);

      switch (body?.eventType) {
        case SignerEventType.ADD: {
          const signedKeyRequestMetadata = decodeSignedKeyRequestMetadata(
            body.metadata
          );
          const metadataJson = {
            requestFid: Number(signedKeyRequestMetadata.requestFid),
            requestSigner: signedKeyRequestMetadata.requestSigner,
            signature: signedKeyRequestMetadata.signature,
            deadline: Number(signedKeyRequestMetadata.deadline),
          };

          events.push({
            ...signerJson,
            metadata: metadataJson,
          });

          break;
        }
        case SignerEventType.REMOVE: {
          break;
        }
      }
    }

    if (resEvents.length < MAX_PAGE_SIZE) {
      break;
    }
  }

  return events;
}
