import { Router } from 'express';
import { getOrders, getOrder, createOrder, updateOrderStatus, togglePaid, deleteOrder } from '../controllers/order.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getOrders);
router.get('/:id', authenticate, getOrder);
router.post('/', authenticate, createOrder);
router.patch('/:id/status', authenticate, requireAdmin, updateOrderStatus);
router.patch('/:id/paid', authenticate, requireAdmin, togglePaid);
router.delete('/:id', authenticate, requireAdmin, deleteOrder);

export default router;
