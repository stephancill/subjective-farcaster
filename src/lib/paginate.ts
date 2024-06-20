import { Message } from "@farcaster/hub-web";

import { transformHashReverse } from "./utils";

export const MAX_PAGE_SIZE = 1000;

export async function getAllMessagesFromHubEndpoint({
  endpoint,
  hubUrl,
  params,
  limit,
  debug,
  onProgress,
}: {
  endpoint: string;
  hubUrl: string;
  params: Record<string, string>;
  limit?: number;
  debug?: boolean;
  onProgress?: (message: string) => void;
}) {
  const messages: Message[] = new Array();
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

    const transformedMessages = resMessages
      .map(transformHashReverse)
      .map(Message.fromJSON);

    messages.push(...transformedMessages);

    if (debug) {
      console.log(
        `Total messages ${messages.length.toLocaleString()} from ${url}`
      );
    }

    onProgress?.(
      `Fetched ${messages.length.toLocaleString()} messages from ${endpoint}`
    );

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
