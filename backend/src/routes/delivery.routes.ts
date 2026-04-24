import { Router } from 'express';
import { getDeliveries, getDelivery, createDelivery, updateDeliveryStatus, toggleDeliveryPaid, deleteDelivery } from '../controllers/delivery.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getDeliveries);
router.get('/:id', authenticate, getDelivery);
router.post('/', authenticate, createDelivery);
router.patch('/:id/status', authenticate, updateDeliveryStatus);
router.patch('/:id/paid', authenticate, toggleDeliveryPaid);
router.delete('/:id', authenticate, requireAdmin, deleteDelivery);

export default router;
