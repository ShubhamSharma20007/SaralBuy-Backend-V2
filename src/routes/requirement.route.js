import express from 'express';
import {
  getRecentRequirements,
  createRequirement,
  getBuyerRequirements,
  getApprovedPendingRequirements,
  getCompletedApprovedRequirements,
} from '../controllers/requirement.controller.js';
import auth from '../middleware/auth.middleware.js';
const router = express.Router();

router.get('/recent-requirements', getRecentRequirements);
router.post('/create', auth, createRequirement);
router.get('/my-requirements', auth, getBuyerRequirements);
router.get('/approved-pending', auth, getApprovedPendingRequirements);
router.get('/completed-approved', auth, getCompletedApprovedRequirements);
export default router;
