let browserTimeZone: string | undefined;

export const getBrowserTimeZone = (): string => {
  browserTimeZone ??=
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return browserTimeZone;
};

export const getCalendarDate = (timestamp: number, entryDate?: string): {
  date: string;
  year: number;
  month: number;
} => {
  if (entryDate) {
    const [year, month] = entryDate.split("-").map(Number);
    if (Number.isInteger(year) && Number.isInteger(month)) {
      return { date: entryDate, year, month: month - 1 };
    }
  }

  const localDate = new Date(timestamp);
  const year = localDate.getFullYear();
  const month = localDate.getMonth();
  const day = localDate.getDate();

  return {
    date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    year,
    month,
  };
};
