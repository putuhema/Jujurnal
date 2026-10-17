import type * as THREE from "three";

// A shareable postcard of your garden: the 3D view on a sky-coloured card with
// the month, a line of stats and the app's name. Sized for stories (4:5).

const WIDTH = 1080;
const HEIGHT = 1350;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

export const makePostcard = async ({
  renderer,
  scene,
  camera,
  title,
  subtitle,
  sky,
}: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  title: string;
  subtitle: string;
  sky: [string, string];
}) => {
  // Render a fresh frame and read it straight away, before the browser clears it.
  renderer.render(scene, camera);
  const garden = await loadImage(renderer.domElement.toDataURL("image/png"));

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d")!;

  const background = context.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, sky[0]);
  background.addColorStop(1, sky[1]);
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // The garden fills the middle of the card, cropped to its centre.
  const area = { x: 60, y: 210, width: WIDTH - 120, height: HEIGHT - 420 };
  const scale = Math.max(area.width / garden.width, area.height / garden.height);
  const sourceWidth = area.width / scale;
  const sourceHeight = area.height / scale;
  context.save();
  context.beginPath();
  context.roundRect(area.x, area.y, area.width, area.height, 48);
  context.clip();
  context.drawImage(garden, (garden.width - sourceWidth) / 2, (garden.height - sourceHeight) / 2, sourceWidth, sourceHeight, area.x, area.y, area.width, area.height);
  context.restore();

  const dark = sky[0].startsWith("#1") || sky[0].startsWith("#2");
  context.fillStyle = dark ? "#f7f2e8" : "#2c3328";
  context.textAlign = "center";
  context.font = "600 64px 'DM Serif Display', Georgia, serif";
  context.fillText(title, WIDTH / 2, 130);
  context.font = "500 34px 'DM Sans', system-ui, sans-serif";
  context.globalAlpha = 0.75;
  context.fillText(subtitle, WIDTH / 2, 178);
  context.globalAlpha = 1;
  context.font = "600 40px 'DM Sans', system-ui, sans-serif";
  context.fillText("✿ bloom", WIDTH / 2, HEIGHT - 90);

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the postcard"))), "image/png"));
};

// Share the postcard where the phone supports it; otherwise download it.
export const sharePostcard = async (blob: Blob, fileName: string, text: string) => {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return { result: "shared" as const };
    } catch (error) {
      const name = (error as Error).name;
      if (name === "AbortError") return { result: "cancelled" as const };
      // Making the card took long enough that the tap no longer counts: ask for another.
      if (name === "NotAllowedError") return { result: "needsTap" as const, share: () => navigator.share({ files: [file], text }).catch(() => {}) };
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { result: "downloaded" as const };
};
