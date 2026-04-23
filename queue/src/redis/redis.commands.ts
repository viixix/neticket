import syncAndPromoteWaitersLua from './sync-and-promote-waiters.lua';
import registerAndGetPositionLua from './register-and-get-position.lua';

export const REDIS_COMMANDS = {
  SYNC_AND_PROMOTE_WAITERS: {
    name: 'syncAndPromoteWaiters',
    numberOfKeys: 4,
    lua: syncAndPromoteWaitersLua,
  },
  REGISTER_AND_GET_POSITION: {
    name: 'registerAndGetPosition',
    numberOfKeys: 2,
    lua: registerAndGetPositionLua,
  },
};
