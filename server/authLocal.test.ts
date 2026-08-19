import { describe, expect, it } from "vitest";
import {
  AuthLocalError,
  hashPassword,
  isLocalUser,
  localOpenId,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "./authLocal";

describe("autenticação local", () => {
  it("normaliza o nome de usuário e cria o openId local", () => {
    expect(validateUsername(" Oficina.Central ")).toBe("oficina.central");
    expect(localOpenId("oficina.central")).toBe("local_oficina.central");
    expect(isLocalUser("local_oficina.central")).toBe(true);
    expect(isLocalUser("usuario_invalido")).toBe(false);
  });

  it("rejeita nomes de usuário e senhas inválidos", () => {
    expect(() => validateUsername("ab")).toThrow(AuthLocalError);
    expect(() => validateUsername("nome com espaço")).toThrow(AuthLocalError);
    expect(() => validatePassword("12345")).toThrow(AuthLocalError);
  });

  it("protege a senha com hash bcrypt e valida a credencial correta", async () => {
    const hash = await hashPassword("senha-segura");
    expect(hash).not.toBe("senha-segura");
    await expect(verifyPassword("senha-segura", hash)).resolves.toBe(true);
    await expect(verifyPassword("senha-incorreta", hash)).resolves.toBe(false);
  });
});
