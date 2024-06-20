import {
  getInsecureHubRpcClient,
  getSSLHubRpcClient,
} from "@farcaster/hub-nodejs";
import { HUB_HOST, HUB_SSL } from "./const";

export function getHubClient(host: string, { ssl }: { ssl?: boolean }) {
  const hub = ssl ? getSSLHubRpcClient(host) : getInsecureHubRpcClient(host);
  return hub;
}

export const hubClient = getHubClient(HUB_HOST, { ssl: HUB_SSL === "true" });
