import { PostForm } from "@/components/post-form";
import { Posts } from "@/components/posts";

export default function Homepage() {
  return (
    <div className="space-y-6">
      <PostForm />
      <Posts />
    </div>
  );
}
