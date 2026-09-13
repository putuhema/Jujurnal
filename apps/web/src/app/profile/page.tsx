import { MoodTracker } from "@/components/mood-tracker";
import { WeeklyRecap } from "@/components/weekly-recap";

export default function Profile() {
  return (
    <>
      <WeeklyRecap />
      <MoodTracker />
    </>
  );
}
