import { getDateString } from "./helpers";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const getReminderOccurrence = ({
  now,
  timeZone,
  days,
  time,
  lastSentDate,
}: {
  now: number;
  timeZone: string;
  days: number[];
  time: string;
  lastSentDate?: string;
}) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = WEEKDAYS.indexOf(value("weekday"));
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  const [hour, minute] = time.split(":").map(Number);
  const localDate = getDateString(now, timeZone);

  return {
    due:
      days.includes(day) &&
      minutes >= hour * 60 + minute &&
      lastSentDate !== localDate,
    localDate,
  };
};
