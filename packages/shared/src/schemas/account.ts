import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;

/** E-mail de connexion : comparé en minuscules, sans espaces autour. */
export const EmailSchema = z
  .string()
  .trim()
  .max(254)
  .transform((email) => email.toLowerCase())
  .pipe(z.email('Adresse e-mail invalide'));

const NewPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `${PASSWORD_MIN_LENGTH} caractères minimum`)
  .max(200);

export const LoginSchema = z.object({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(200),
});

export const InvitationAcceptSchema = z.object({
  name: z.string().trim().min(1, 'Le prénom est obligatoire').max(60),
  email: EmailSchema,
  password: NewPasswordSchema,
});

export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: NewPasswordSchema,
});

export type SessionUser = { id: number; name: string; email: string | null; isAdmin: boolean };

export type Invitation = { id: number; createdAt: string; expiresAt: string };
/** Réponse à la création : le jeton n'est montré qu'une fois (seule son empreinte est stockée). */
export type CreatedInvitation = Invitation & { token: string };
