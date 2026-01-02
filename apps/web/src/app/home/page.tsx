import { PostForm } from "@/components/post-form";
import { Posts } from "@/components/posts";
import { Streak } from "@/components/streak";
import { Summaries } from "@/components/summaries";

export default function Homepage() {
  return (
    <div className="space-y-6">
      <Streak />
      <Summaries />
      <PostForm />
      <Posts />
    </div>
  );
}
