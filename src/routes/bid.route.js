import express from 'express';
import auth from '../middleware/auth.middleware.js';
import {
  getLatestThreeBidAndDraft,
  bidOverViewbyId,
  updateBidUserDetails,
  createBid,
  getAllBids,
  getBidById,
  getBidByProductId,
} from '../controllers/bid.controller.js';
const router = express.Router();
router.post('/create/:buyerId/:productId', auth, createBid);
router.get('/get-three-latest-bid-and-draft', auth, getLatestThreeBidAndDraft);
router.get('/bid-overview/:id', auth, bidOverViewbyId);
router.put('/update-bid-user-dets/:id', auth, updateBidUserDetails);
router.get('/get-all-bid', auth, getAllBids);
router.get('/bid-details/:id', auth, getBidById);
router.get('/get-bid-by-productId/:productId', getBidByProductId);

export default router;
