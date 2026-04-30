import express from 'express';
import auth from '../middleware/auth.js';
import {allowUploadFields} from  "../utils/multer.js"
import { addProduct,getTrendingCategory,getHomeProducts,getProductByName, searchProductsController,getProductById } from '../controllers/product.controller.js';
const router = express.Router()

router.post('/add-product/:categoryId/:subCategoryId', auth, allowUploadFields(), addProduct);
router.get('/get-trending-category',getTrendingCategory);
router.get('/get-home-products',getHomeProducts);
router.get('/get-product/:productName', getProductByName);
router.get('/get-products-by-title/search', searchProductsController);
router.get('/get-product-by-id/:productId', getProductById);
export default router;