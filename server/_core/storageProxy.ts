import express, { type Express } from "express";
import { localUploadsDirectory } from "../storage";

/** Expõe as fotos persistidas localmente, sem depender de serviço externo. */
export function registerStorageProxy(app: Express) {
  app.use("/uploads", express.static(localUploadsDirectory, { fallthrough: false }));
}
