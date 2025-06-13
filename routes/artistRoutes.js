const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  getArtistProfile,
  getEarnings,
  toggleFollow,
} = require("../controllers/artistController");

router.get("/profile/:address", getArtistProfile);
router.get("/earnings", auth, getEarnings);
router.post("/follow/:address", auth, toggleFollow);

module.exports = router;
