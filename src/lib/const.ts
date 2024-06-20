export const HUB_URL = process.env.HUB_REST_URL!;

export const HUB_HOST = process.env.HUB_HOST!;
export const HUB_SSL = process.env.HUB_SSL!;

export const APP_URL = process.env.APP_URL!;

export const REDIS_URL = process.env.REDIS_URL!;
export const POPULATE_NETWORK_JOB_NAME = "refreshNetwork";
export const POPULATE_FOLLOWERS_JOB_NAME = "populateFollowers";

export const RESULT_CACHE_EX = 60 * 60; // 1 hour
export const STATUS_CACHE_EX = 60 * 60; // 1 hour

export const NEO4J_URI = process.env.NEO4J_URI!;
export const NEO4J_USER = process.env.NEO4J_USER!;
export const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD!;
