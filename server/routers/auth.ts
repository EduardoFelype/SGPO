import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  AuthLocalError,
  hashPassword,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "../authLocal";
import * as db from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { createLocalSessionToken } from "../_core/localSession";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(6).max(128),
});

function authInputError(error: unknown): never {
  if (error instanceof AuthLocalError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

async function setLocalSession(
  ctx: { req: Parameters<typeof getSessionCookieOptions>[0]; res: any },
  user: Awaited<ReturnType<typeof db.getUserByUsername>>
) {
  if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const token = await createLocalSessionToken(user);
  ctx.res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  setupStatus: publicProcedure.query(async () => ({
    needsInitialSetup: (await db.countUsers()) === 0,
  })),

  registerInitialAdmin: publicProcedure
    .input(
      credentialsSchema.extend({
        name: z.string().trim().min(2).max(255),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if ((await db.countUsers()) > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "A configuração inicial já foi concluída.",
        });
      }
      try {
        const username = validateUsername(input.username);
        const password = validatePassword(input.password);
        const user = await db.createUserLocal({
          username,
          name: input.name,
          email: input.email ?? null,
          passwordHash: await hashPassword(password),
          role: "admin",
        });
        await setLocalSession(ctx, user);
        return { id: user.id, username: user.username, role: user.role };
      } catch (error) {
        if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: "Usuário já existe." });
        }
        return authInputError(error);
      }
    }),

  login: publicProcedure.input(credentialsSchema).mutation(async ({ ctx, input }) => {
    try {
      const username = validateUsername(input.username);
      const user = await db.getUserByUsername(username);
      if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
      }
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      await setLocalSession(ctx, user);
      return { id: user.id, username: user.username, role: user.role };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      return authInputError(error);
    }
  }),

  createUser: adminProcedure
    .input(
      credentialsSchema.extend({
        name: z.string().trim().min(2).max(255),
        email: z.string().email().optional(),
        role: z.enum(["admin", "user"]).default("user"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const username = validateUsername(input.username);
        const password = validatePassword(input.password);
        const user = await db.createUserLocal({
          username,
          name: input.name,
          email: input.email ?? null,
          passwordHash: await hashPassword(password),
          role: input.role,
        });
        return { id: user.id, username: user.username, role: user.role };
      } catch (error) {
        if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: "Usuário já existe." });
        }
        return authInputError(error);
      }
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});
