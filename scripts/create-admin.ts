import { hashPassword, validatePassword, validateUsername } from "../server/authLocal";
import * as db from "../server/db";

async function main() {
  const username = validateUsername(process.env.ADMIN_USERNAME ?? "");
  const password = validatePassword(process.env.ADMIN_PASSWORD ?? "");
  const name = (process.env.ADMIN_NAME ?? "Administrador SGPO").trim();
  const email = process.env.ADMIN_EMAIL?.trim() || null;

  if (await db.getUserByUsername(username)) {
    console.log(`O usuário '${username}' já existe. Nenhuma alteração foi feita.`);
    return;
  }

  await db.createUserLocal({
    username,
    name,
    email,
    passwordHash: await hashPassword(password),
    role: "admin",
  });
  console.log(`Administrador '${username}' criado com sucesso.`);
}

main().catch((error) => {
  console.error("Não foi possível criar o administrador:", error.message);
  process.exit(1);
});
