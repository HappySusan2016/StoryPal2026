/** @module Story image compression and Firestore document size limits */
export const storyImageAccept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
export const storyDraftByteLimit = 980 * 1024;

/** Convert images to size-limited JPEG data URLs for compatibility with existing story documents. */
export async function encodeStoryImage(file, { cropToCoverRatio = false } = {}) {
  if (!storyImageAccept.split(",").includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw new Error("Choose a JPG, PNG, WebP, GIF, or AVIF image under 20 MB.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    // Center-crop generated images to 3:2 as needed. Preserve the original aspect ratio of uploads.
    const sourceWidth = cropToCoverRatio ? Math.min(bitmap.width, bitmap.height * 3 / 2) : bitmap.width;
    const sourceHeight = cropToCoverRatio ? Math.min(bitmap.height, bitmap.width * 2 / 3) : bitmap.height;
    const sourceX = (bitmap.width - sourceWidth) / 2;
    const sourceY = (bitmap.height - sourceHeight) / 2;
    for (const maxSide of [960, 720, 540, 400]) {
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const ratioUnits = Math.max(1, Math.floor(Math.min(sourceWidth, maxSide) / 3));
      canvas.width = cropToCoverRatio ? ratioUnits * 3 : Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = cropToCoverRatio ? ratioUnits * 2 : Math.max(1, Math.round(sourceHeight * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.75);
      if (image.startsWith("data:image/jpeg;base64,") && image.length <= 80 * 1024) return image;
    }
    throw new Error("Could not prepare this image. Try a smaller image.");
  } finally {
    bitmap.close();
  }
}
