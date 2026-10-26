import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { AppError } from '../lib/errors';
import { requireAdmin } from '../lib/session';
import { validate } from '../lib/validate';
import { createInvitation, listInvitations, revokeInvitation } from '../services/users';

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

/** Invitations envoyées par l'administrateur connecté. */
export function invitationRoutes({ db, logger }: AppDeps) {
  return new Hono()
    .use(requireAdmin)
    .get('/', (c) => c.json(listInvitations(db, c.get('user').id)))
    .post('/', (c) => {
      const invitation = createInvitation(db, c.get('user').id);
      logger.info({ userId: c.get('user').id, invitationId: invitation.id }, 'invitation.created');
      return c.json(invitation, 201);
    })
    .delete('/:id', validate('param', IdParamSchema), (c) => {
      if (!revokeInvitation(db, c.get('user').id, c.req.valid('param').id)) {
        throw new AppError('NOT_FOUND', 404, 'Cette invitation n’existe plus');
      }
      return c.body(null, 204);
    });
}
