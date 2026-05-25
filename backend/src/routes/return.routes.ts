import { Router } from 'express';
import { getReturns, getReturn, createReturn, updateReturn, updateReturnStatus, toggleReturnPaid, deleteReturn } from '../controllers/return.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getReturns);
router.get('/:id', authenticate, getReturn);
router.post('/', authenticate, createReturn);
router.patch('/:id', authenticate, updateReturn);
router.patch('/:id/status', authenticate, updateReturnStatus);
router.patch('/:id/paid', authenticate, toggleReturnPaid);
router.delete('/:id', authenticate, requireAdmin, deleteReturn);

export default router;
