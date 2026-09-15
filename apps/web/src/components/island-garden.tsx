import { getPlantSpriteFrame } from "@/lib/garden-sprites";
import { GardenFlower } from "./garden-flower";
import type { Id } from "@puma-brain/backend/convex/_generated/dataModel";

type IslandPost = {
  _id: Id<"posts">;
  _creationTime: number;
  body: string;
  flowerId?: number;
  mood: Parameters<typeof GardenFlower>[0]["mood"];
  visibility?: "public" | "private";
  reactionCount?: number;
};

// Soil centers measured in main_island.png (1536 × 1024), back to front.
// The artwork contains 30 plots: 3 + 4 + 5 + 6 + 5 + 4 + 3.
const flowerPositions = [
  [583, 306], [770, 306], [957, 306],
  [478, 371], [674, 371], [865, 371], [1056, 371],
  [377, 436], [575, 436], [767, 436], [962, 436], [1159, 436],
  [278, 501], [476, 501], [671, 501], [865, 501], [1060, 501], [1256, 501],
  [375, 567], [573, 567], [767, 567], [962, 567], [1159, 567],
  [473, 632], [670, 632], [865, 632], [1061, 632],
  [570, 698], [765, 698], [962, 698],
] as const;

export const IslandGarden = ({
  posts,
  size = "md",
}: {
  posts: IslandPost[];
  size?: "xs" | "sm" | "md" | "lg";
}) => {
  let newestPostId = posts[0]?._id;
  let newestPostTime = posts[0]?._creationTime ?? 0;

  for (const post of posts) {
    if (post._creationTime > newestPostTime) {
      newestPostId = post._id;
      newestPostTime = post._creationTime;
    }
  }

  return (
    <div className="space-y-4">
      {Array.from({ length: Math.max(1, Math.ceil(posts.length / flowerPositions.length)) }, (_, page) => (
        <div key={page} className="island-garden relative isolate mx-auto aspect-[1536/1024] w-full max-w-3xl overflow-hidden">
          <img
            src="/main_island.png"
            alt=""
            className="pointer-events-none absolute inset-0 size-full object-contain select-none"
          />
          {posts.slice(page * flowerPositions.length, (page + 1) * flowerPositions.length).map((post, index) => {
            const [left, top] = flowerPositions[index % flowerPositions.length];
            const { anchorX, anchorY } = getPlantSpriteFrame(post.mood, post.flowerId);
            const isNewest = post._id === newestPostId;

            return (
              <div
                key={post._id}
                className="absolute w-[8%] focus-within:z-50! hover:z-50!"
                style={{ left: `${left / 1536 * 100}%`, top: `${top / 1024 * 100}%`, zIndex: index + 1, transform: `translate(-${anchorX}%, -${anchorY}%)` }}
              >
                <GardenFlower
                  fitPlot
                  flowerId={post.flowerId || 1}
                  mood={post.mood}
                  text={post.body}
                  postId={post._id}
                  visibility={post.visibility ?? "public"}
                  reactionCount={post.reactionCount ?? 0}
                  size={size}
                  createdAt={new Date(post._creationTime)}
                  isNewest={isNewest}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
