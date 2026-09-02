import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "send scheduled journal reminders",
  { minutes: 1 },
  internal.reminderDelivery.sendDueReminders
);

export default crons;
