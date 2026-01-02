import { PostForm } from "@/components/post-form";
import { Posts } from "@/components/posts";
import { Streak } from "@/components/streak";

export default function Homepage() {
  return (
    <div className="space-y-6">
      <Streak />
      <PostForm />
      <Posts />
    </div>
  );
}
