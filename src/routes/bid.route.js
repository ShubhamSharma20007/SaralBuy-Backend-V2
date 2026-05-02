import express from 'express';
import auth from '../middleware/auth.js';
import {
  getLatestThreeBidAndDraft,
  bidOverViewbyId,
  updateBidUserDetails,
  createBid,
  getAllBids,
  getBidById,
} from '../controllers/bid.controller.js';
const router = express.Router();
router.post('/create/:buyerId/:productId', auth, createBid);
router.get('/get-three-latest-bid-and-draft', auth, getLatestThreeBidAndDraft);
router.get('/bid-overview/:id', auth, bidOverViewbyId);
router.put('/update-bid-user-dets/:id', auth, updateBidUserDetails);
router.get('/get-all-bid', auth, getAllBids);
router.get('/bid-details/:id', auth, getBidById);

export default router;
