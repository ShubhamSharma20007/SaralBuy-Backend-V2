import express from 'express';
import { addToCart, getUserCart, removeCart } from '../controllers/cart.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/add', auth, addToCart);
router.get('/get-cart', auth, getUserCart);
router.post('/remove-cart/:cartId/:productId', auth, removeCart);
export default router;
