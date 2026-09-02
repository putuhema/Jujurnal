export const JOURNAL_REMINDER_ENABLED_KEY = "jujurnal.journalReminderEnabled";
export const JOURNAL_REMINDER_LAST_SENT_KEY = "jujurnal.journalReminderLastSent";
export const JOURNAL_REMINDER_CHANGED_EVENT = "jujurnal:journal-reminder-changed";

export const isJournalReminderEnabled = () =>
  typeof window !== "undefined" &&
  window.localStorage.getItem(JOURNAL_REMINDER_ENABLED_KEY) === "true";

export const setJournalReminderEnabled = (enabled: boolean) => {
  window.localStorage.setItem(JOURNAL_REMINDER_ENABLED_KEY, String(enabled));
  window.dispatchEvent(
    new CustomEvent(JOURNAL_REMINDER_CHANGED_EVENT, { detail: enabled })
  );
};

export const getLocalDateString = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
