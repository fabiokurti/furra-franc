import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import {
  getShopProducts, createShopProduct, updateShopProduct, deleteShopProduct,
  getShopSales, createShopSale, deleteShopSale, getAllShopSalesAdmin, getMyDeliveries,
} from '../controllers/shop.controller';

const router = Router();

router.get('/products', authenticate, getShopProducts);
router.post('/products', authenticate, createShopProduct);
router.patch('/products/:id', authenticate, updateShopProduct);
router.delete('/products/:id', authenticate, deleteShopProduct);

router.get('/sales', authenticate, getShopSales);
router.post('/sales', authenticate, createShopSale);
router.delete('/sales/:id', authenticate, deleteShopSale);
router.get('/sales/all', authenticate, requireAdmin, getAllShopSalesAdmin);
router.get('/my-deliveries', authenticate, getMyDeliveries);

export default router;
