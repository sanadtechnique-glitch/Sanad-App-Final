const MAX_SIZE_BYTES = 800 * 1024;
const MAX_DIMENSION = 1200;

export async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_SIZE_BYTES && !isOversized(file)) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      tryCompress(canvas, file, 0.85, resolve, reject);
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

function isOversized(file: File): boolean {
  return file.type === "image/bmp" || file.type === "image/tiff";
}

function tryCompress(
  canvas: HTMLCanvasElement,
  original: File,
  quality: number,
  resolve: (f: File) => void,
  reject: (e: Error) => void,
): void {
  canvas.toBlob(
    (blob) => {
      if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
      if (blob.size <= MAX_SIZE_BYTES || quality <= 0.3) {
        const ext = original.name.replace(/\.[^.]+$/, "") + ".jpg";
        resolve(new File([blob], ext, { type: "image/jpeg" }));
      } else {
        tryCompress(canvas, original, quality - 0.1, resolve, reject);
      }
    },
    "image/jpeg",
    quality,
  );
}
