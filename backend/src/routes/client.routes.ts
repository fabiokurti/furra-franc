import { Router } from 'express';
import { getClients, getClient, createClient, updateClient, deleteClient, upsertClientPrice } from '../controllers/client.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getClients);
router.get('/:id', authenticate, getClient);
router.post('/', authenticate, requireAdmin, createClient);
router.patch('/:id', authenticate, requireAdmin, updateClient);
router.put('/:clientId/prices/:productId', authenticate, requireAdmin, upsertClientPrice);
router.delete('/:id', authenticate, requireAdmin, deleteClient);

export default router;
