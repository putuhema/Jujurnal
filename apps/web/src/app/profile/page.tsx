import { Achievements } from "@/components/achievements";
import { MoodTracker } from "@/components/mood-tracker";
import { Streak } from "@/components/streak";

export default function Profile() {
  return (
    <div className="space-y-6">
      <Streak />
      <MoodTracker />
      <Achievements />
    </div>
  );
}
