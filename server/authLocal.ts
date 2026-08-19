import bcrypt from "bcryptjs";

export const LOCAL_PREFIX = "local_";

/**
 * Autenticação local própria do SGPO (v1.2).
 *
 * Substitui a dependência do OAuth externo por login com usuário/senha.
 * - Senhas armazenadas com bcrypt (cost 10).
 * - Sessão criada com JWT HS256 assinado com JWT_SECRET (mesmo mecanismo de
 *   sessão já usado pelo template), com `openId` sintético `local_<username>`
 *   para reutilizar o fluxo existente de usuário.
 */

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,64}$/;
const MIN_PASSWORD_LENGTH = 6;

export class AuthLocalError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function validateUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_REGEX.test(normalized)) {
    throw new AuthLocalError(
      "INVALID_USERNAME",
      "Usuário deve ter entre 3 e 64 caracteres (letras, números, . _ -)."
    );
  }
  return normalized;
}

export function validatePassword(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthLocalError(
      "INVALID_PASSWORD",
      `Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`
    );
  }
  return password;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** openId sintético usado para usuários locais */
export function localOpenId(username: string): string {
  return `${LOCAL_PREFIX}${username}`;
}

export function isLocalUser(openId: string): boolean {
  return openId.startsWith(LOCAL_PREFIX);
}

export function isLocalSessionPayload(payload: {
  openId: string;
}): boolean {
  return isLocalUser(payload.openId);
}
