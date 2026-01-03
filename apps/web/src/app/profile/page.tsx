import { Achievements } from "@/components/achievements";
import { MoodTracker } from "@/components/mood-tracker";

export default function Profile() {
  return (
    <div className="space-y-6">
      <MoodTracker />
      <Achievements />
    </div>
  );
}
