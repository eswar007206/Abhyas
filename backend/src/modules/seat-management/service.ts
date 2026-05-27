import { conflict } from "../../http/errors.js";
import type { Organization } from "../../types/domain.js";

export interface SeatUsageSnapshot {
  purchased: number;
  used: number;
  remaining: number;
}

export function getSeatUsage(organization: Organization): SeatUsageSnapshot {
  const purchased = organization.seat_limit;
  const used = organization.active_students;
  return {
    purchased,
    used,
    remaining: Math.max(purchased - used, 0),
  };
}

export function assertSeatAvailable(organization: Organization): SeatUsageSnapshot {
  const usage = getSeatUsage(organization);
  if (usage.used >= usage.purchased) {
    throw conflict("SEAT_LIMIT_REACHED", "Seat limit reached. Upgrade plan.", {
      usedSeats: usage.used,
      seatLimit: usage.purchased,
      remainingSeats: usage.remaining,
    });
  }
  return usage;
}
