import { GardenFlower } from "./garden-flower";

type IslandPost = {
  _id: string;
  _creationTime: number;
  body: string;
  flowerId?: number;
  mood: Parameters<typeof GardenFlower>[0]["mood"];
};

const flowerPositions = [
  [25, 25], [43, 19], [61, 24], [76, 30], [32, 38], [51, 36],
  [69, 42], [82, 48], [23, 53], [40, 52], [59, 54], [74, 59],
  [30, 67], [48, 66], [64, 70], [80, 71], [39, 80], [55, 82],
  [70, 80], [49, 29], [65, 34], [34, 59], [56, 45], [44, 73],
] as const;

export const IslandGarden = ({
  posts,
  size = "md",
}: {
  posts: IslandPost[];
  size?: "xs" | "sm" | "md" | "lg";
}) => (
  <div className="island-garden relative isolate mx-auto aspect-[1157/1120] w-full max-w-3xl overflow-hidden">
    <img
      src="/island.png"
      alt=""
      className="pointer-events-none absolute inset-0 size-full object-contain select-none"
    />
    {posts.map((post, index) => {
      const [left, top] = flowerPositions[index % flowerPositions.length];
      return (
        <div
          key={post._id}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${left}%`, top: `${top}%` }}
        >
          <GardenFlower
            flowerId={post.flowerId || 1}
            mood={post.mood}
            text={post.body}
            postId={post._id}
            size={size}
            createdAt={new Date(post._creationTime)}
          />
        </div>
      );
    })}
  </div>
);
