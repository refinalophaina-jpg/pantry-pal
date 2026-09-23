import { apiRequest, householdPath } from "./api-client";

/**
 * Recipe photo uploads. Photos are downsized in the browser so a phone
 * picture becomes a small JPEG before it reaches the household's private store.
 */
export const IMAGE_UPLOAD_LIMIT = 900_000;

function fileToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const result = String(reader.result); resolve(result.slice(result.indexOf(",") + 1)); };
    reader.onerror = () => reject(new Error("Couldn't read the image file."));
    reader.readAsDataURL(blob);
  });
}

export async function downscaleImage(file: File, maxEdge = 1280, quality = 0.82): Promise<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (typeof createImageBitmap === "function" && typeof document !== "undefined") {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= IMAGE_UPLOAD_LIMIT) return { base64: await fileToBase64(blob), mediaType: "image/jpeg" };
      }
    } catch { /* Fall back to the original file below. */ }
  }
  if (file.size > IMAGE_UPLOAD_LIMIT) throw new Error("Choose a photo under 900 KB, or a browser that can resize it.");
  const mediaType = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
  return { base64: await fileToBase64(file), mediaType };
}

export async function uploadRecipeImage(householdId: string, file: File): Promise<string> {
  const { base64, mediaType } = await downscaleImage(file);
  const { data } = await apiRequest<{ data: { id: string; url: string } }>(householdPath(householdId, "images"), { method: "POST", body: { imageBase64: base64, mediaType }, timeoutMs: 60_000 });
  return data.url;
}
