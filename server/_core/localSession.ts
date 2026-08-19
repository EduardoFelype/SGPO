import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { COOKIE_NAME } from "@shared/const";

const ISSUER = "sgpo-local";
const SESSION_DURATION = "7d";

function sessionSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET deve ter ao menos 32 caracteres para usar a autenticação local."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createLocalSessionToken(user: User): Promise<string> {
  if (!user.username || !user.name) {
    throw new Error("Usuário local sem nome ou identificador.");
  }

  return new SignJWT({
    openId: user.openId,
    username: user.username,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(sessionSecret());
}

function getSessionToken(req: Request): string | undefined {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  return cookies[COOKIE_NAME];
}

export async function authenticateLocalRequest(
  req: Request
): Promise<User | null> {
  const token = getSessionToken(req);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
    });
    const openId = typeof payload.openId === "string" ? payload.openId : null;
    const username = typeof payload.username === "string" ? payload.username : null;
    if (!openId || !username || !openId.startsWith("local_")) return null;

    const user = await db.getUserByOpenId(openId);
    if (!user || user.username !== username || !user.passwordHash) return null;
    return user;
  } catch {
    return null;
  }
}
