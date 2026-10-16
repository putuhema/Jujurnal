export const IslandGardenSkeleton = () => (
  <div aria-hidden="true" className="relative mx-auto grid aspect-[3/2] w-full max-w-3xl place-items-center overflow-hidden">
    <div className="relative w-[58%]">
      <span
        className="block aspect-[2/1] w-full animate-pulse bg-primary/20 motion-reduce:animate-none"
        style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
      />
      <span
        className="absolute inset-x-0 top-1/2 block aspect-[2/1] w-full animate-pulse bg-primary/10 [animation-delay:150ms] motion-reduce:animate-none"
        style={{ clipPath: "polygon(0 0, 50% 50%, 100% 0, 100% 30%, 50% 80%, 0 30%)" }}
      />
    </div>
  </div>
);
