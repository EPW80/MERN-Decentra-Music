const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  uploadTrack,
  getTracks,
  getTrack,
  streamTrack,
  likeTrack
} = require('../controllers/musicController');

router.post('/upload', auth, uploadTrack);
router.get('/tracks', getTracks);
router.get('/track/:trackId', getTrack);
router.post('/stream/:trackId', streamTrack);
router.post('/like/:trackId', auth, likeTrack);

module.exports = router;
