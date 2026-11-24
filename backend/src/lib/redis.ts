import { Redis } from 'ioredis';
import { config } from '../config/index.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis at', config.redisUrl);
});

redis.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err.message);
});

export default redis;
