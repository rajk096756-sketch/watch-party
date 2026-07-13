import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/database.js';
import { authenticateUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authenticatedLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Define tiered daily limits
const TIER_DOWNLOAD_LIMITS = {
  'Free': 1,
  'Bronze': 5,
  'Silver': 15,
  'Gold': 100, // Practically unlimited
};

// Seed default video assets on startup if the database is empty
export async function seedVideosIfEmpty() {
  const count = await prisma.video.count();
  if (count === 0) {
    console.log('[SEEDED] Injecting high-quality public domain video assets into database...');
    await prisma.video.createMany({
      data: [
        {
          title: 'Big Buck Bunny (Animation Movie)',
          description: 'A large and lovable rabbit deals with three harassing rodents in this classic open-source Blender animation.',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_Buck_Bunny_Narrated_Thumbnail.jpg/800px-Big_Buck_Bunny_Narrated_Thumbnail.jpg',
          duration: 596
        },
        {
          title: 'Sintel (Fantasy Quest)',
          description: 'Sintel, a lonely girl, rescues a baby dragon she names Scales, only to have it snatched away by an adult dragon.',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Sintel_poster.jpg',
          duration: 848
        },
        {
          title: 'Tears of Steel (Sci-Fi VFX)',
          description: 'Set in a dystopian future Amsterdam, a group of scientists attempts to rescue the world from rampaging robots.',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
          thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Tears_of_steel_poster.jpg/800px-Tears_of_steel_poster.jpg',
          duration: 734
        },
        {
          title: 'For Bigger Blazes (Nature Showcase)',
          description: 'Explore breathtaking fire footage and cinematic transitions showing the raw force of nature.',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnail: 'https://images.unsplash.com/photo-1508873696983-2df519f0397e?w=800&auto=format&fit=crop&q=60',
          duration: 15
        }
      ]
    });
  }
}

// Ensure seeding triggers
seedVideosIfEmpty().catch(err => console.error('Seeding failed:', err));

/**
 * Route: GET /api/videos
 * Fetch all available videos in the platform
 */
router.get('/', authenticateUser, authenticatedLimiter, async (req, res, next) => {
  try {
    const videos = await prisma.video.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, videos });
  } catch (err) {
    next(err);
  }
});

/**
 * Route: GET /api/videos/:id
 * Fetch details for a specific video
 */
router.get('/:id', authenticateUser, authenticatedLimiter, async (req, res, next) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id }
    });
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found.' });
    }
    return res.status(200).json({ success: true, video });
  } catch (err) {
    next(err);
  }
});

/**
 * Route: POST /api/videos/:id/download
 * Execute subscription-guarded video download incrementation
 */
const downloadSchema = z.object({
  videoId: z.string().uuid()
});

router.post('/:id/download', authenticateUser, authenticatedLimiter, async (req, res, next) => {
  const videoId = req.params.id;
  const userId = req.user.id;
  const userPlan = req.user.subscriptionPlan; // 'Free', 'Bronze', 'Silver', 'Gold'

  try {
    // 1. Verify video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    });
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video file not found.' });
    }

    // 2. Calculate download limits for current calendar day (00:00:00 to 23:59:59)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayDownloadsCount = await prisma.download.count({
      where: {
        userId,
        downloadDate: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    });

    const maxAllowed = TIER_DOWNLOAD_LIMITS[userPlan] || 1;

    if (todayDownloadsCount >= maxAllowed) {
      return res.status(403).json({
        success: false,
        message: `Download locked. You have reached your limit of ${maxAllowed} daily download(s) on the ${userPlan} tier. Upgrade your subscription for higher limits!`,
        currentUsage: todayDownloadsCount,
        maxAllowed,
        requiresUpgrade: true
      });
    }

    // 3. Increment download by creating record in database
    const newDownload = await prisma.download.create({
      data: {
        userId,
        videoId
      }
    });

    return res.status(200).json({
      success: true,
      message: `Download started successfully. Daily usage: ${todayDownloadsCount + 1}/${maxAllowed}.`,
      videoUrl: video.url, // Send the URL for client to download/save
      downloadId: newDownload.id,
      usage: {
        current: todayDownloadsCount + 1,
        max: maxAllowed
      }
    });

  } catch (err) {
    next(err);
  }
});

export default router;
