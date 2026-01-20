import { PostForm } from "@/components/post-form";
import { AllGardensView } from "@/components/all-gardens-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <PostForm />
      <AllGardensView />
    </div>
  );
}
