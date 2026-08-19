import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Diretório persistente para fotos de veículos e ordens de serviço. */
export const localUploadsDirectory = path.resolve(
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")
);

function normalizeKey(relKey: string): string {
  const normalized = path.posix.normalize(relKey.replace(/^\/+/, ""));
  if (!normalized || normalized === "." || normalized.startsWith("../")) {
    throw new Error("Chave de arquivo inválida.");
  }
  return normalized;
}

function addUniqueSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1
    ? `${relKey}_${hash}`
    : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = addUniqueSuffix(normalizeKey(relKey));
  const target = path.resolve(localUploadsDirectory, key);
  if (!target.startsWith(`${localUploadsDirectory}${path.sep}`)) {
    throw new Error("Chave de arquivo inválida.");
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  return `/uploads/${key}`;
}
