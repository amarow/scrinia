import { Router } from 'express';
import { authenticateToken } from '../auth';
import { PrivacyController } from '../controllers/PrivacyController';

const router = Router();

router.get('/profiles', authenticateToken, PrivacyController.getProfiles);
router.post('/profiles', authenticateToken, PrivacyController.createProfile);
router.delete('/profiles/:id', authenticateToken, PrivacyController.deleteProfile);
router.patch('/profiles/:id', authenticateToken, PrivacyController.updateProfile);

router.get('/profiles/:id/rules', authenticateToken, PrivacyController.getRules);
router.post('/profiles/:id/rules', authenticateToken, PrivacyController.addRule);
router.delete('/rules/:id', authenticateToken, PrivacyController.deleteRule);
router.patch('/rules/:id/toggle', authenticateToken, PrivacyController.toggleRule);

export default router;
