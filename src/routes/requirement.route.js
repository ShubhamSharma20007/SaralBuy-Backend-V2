import express from 'express';
import {
  getRecentRequirements,
  createRequirement,
  getBuyerRequirements,
  // getApprovedPendingRequirements,
  // getCompletedApprovedRequirements,
  getRequirementById,
  getRequirementAwarded,
  getDealAwarded
} from '../controllers/requirement.controller.js';
import auth from '../middleware/auth.middleware.js';
const router = express.Router();

router.get('/recent-requirements', getRecentRequirements);
router.post('/create', auth, createRequirement);
router.get('/my-requirements', auth, getBuyerRequirements);

router.get('/get-requirement/:id', auth, getRequirementById);
router.get(
  "/requirement-awarded",
  auth,
  getRequirementAwarded
);
router.get(
  "/deal-awarded",
  auth,
  getDealAwarded
);
export default router;
