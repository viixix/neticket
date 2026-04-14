import atomicReservationLua from '../reservation/lua/atomic-reservation.lua';

export const REDIS_COMMANDS = {
  ATOMIC_RESERVATION: {
    name: 'atomicReservation',
    lua: atomicReservationLua,
  },
};
