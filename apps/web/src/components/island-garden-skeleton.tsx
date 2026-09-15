import { preload } from "react-dom";

export const IslandGardenSkeleton = () => {
  preload("/plants-atlas.webp", { as: "image" });

  return (
  <div aria-hidden="true" className="space-y-4">
    <div className="flex justify-end">
      <div className="h-8 w-28 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
    </div>
  <div
    aria-hidden="true"
    className="relative mx-auto aspect-[1536/1024] w-full max-w-3xl overflow-hidden"
  >
    <div className="garden-zoom-scene absolute inset-0" data-zoom="auto">
    <img
      src="/main_island.webp"
      alt=""
      width={1536}
      height={1024}
      className="pointer-events-none absolute inset-0 size-full animate-pulse object-contain opacity-25 grayscale select-none motion-reduce:animate-none"
    />
    {[583, 770, 957].map((left, index) => (
      <span
        key={left}
        className="absolute aspect-[160/96] w-[10.4%] -translate-x-1/2 -translate-y-1/2 animate-pulse bg-primary/20 motion-reduce:animate-none"
        style={{
          left: `${left / 1536 * 100}%`,
          top: `${306 / 1024 * 100}%`,
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
          animationDelay: `${index * 150}ms`,
        }}
      />
    ))}
    </div>
  </div>
  </div>
  );
};
