import express from 'express';
import { getRecentRequirements, createRequirement } from '../controllers/requirement.controller.js';
import auth from '../middleware/auth.js';
const router = express.Router();

router.get('/recent-requirements', getRecentRequirements);
router.post('/create', auth, createRequirement);
export default router;
