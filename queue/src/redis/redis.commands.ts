import syncAndPromoteWaitersLua from './sync-and-promote-waiters.lua';

export const REDIS_COMMANDS = {
  SYNC_AND_PROMOTE_WAITERS: {
    name: 'syncAndPromoteWaiters',
    numberOfKeys: 4,
    lua: syncAndPromoteWaitersLua,
  },
};
