import { PostForm } from "@/components/post-form";
import { Posts } from "@/components/posts";
import { Streak } from "@/components/streak";

export default function Page() {
  return (
    <div className="space-y-6">
      <PostForm />
      <Posts />
    </div>
  );
}
