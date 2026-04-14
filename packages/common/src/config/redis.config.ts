import { registerAs } from "@nestjs/config";

export const redisConfig = registerAs("redis", () => ({
  queue: {
    host: process.env.REDIS_QUEUE_HOST || "localhost",
    port: parseInt(process.env.REDIS_QUEUE_PORT || "6379", 10),
    password: process.env.REDIS_QUEUE_PASSWORD,
  },
  core: {
    host: process.env.REDIS_CORE_HOST || "localhost",
    port: parseInt(process.env.REDIS_CORE_PORT || "6380", 10),
    password: process.env.REDIS_CORE_PASSWORD,
  },
}));
