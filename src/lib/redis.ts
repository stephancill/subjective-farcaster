import Redis from "ioredis";
import { REDIS_URL } from "./const";

export const redis = new Redis(REDIS_URL, {
  connectTimeout: 5_000,
  maxRetriesPerRequest: null,
});
