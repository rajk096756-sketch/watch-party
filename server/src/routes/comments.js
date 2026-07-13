import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/database.js';
import { authenticateUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authenticatedLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Moderation banned word list
const ABUSIVE_WORDS = ['spam', 'abuse', 'hack', 'scam', 'vulgar', 'fraud', 'cheat'];

/**
 * Moderation Engine
 * Blocks character flooding, abusive words, and spam.
 */
function moderateContent(text) {
  // 1. Character flooding (e.g. "aaaaaaa" or "!!!!!!!!!!")
  // Detects 5 or more repeated consecutive characters
  const floodRegex = /(.)\1{4,}/;
  if (floodRegex.test(text)) {
    return { blocked: true, reason: 'Spam filter: Character flooding detected (excessive repeated characters).' };
  }

  // 2. Spam link threshold
  const linkCount = (text.match(/https?:\/\/[^\s]+/gi) || []).length;
  if (linkCount > 1) {
    return { blocked: true, reason: 'Spam filter: Contains too many web URLs.' };
  }

  // 3. Abusive words filter (word boundary checked)
  for (const word of ABUSIVE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(text)) {
      return { blocked: true, reason: 'Moderation filter: Message contains blocked or abusive language.' };
    }
  }

  return { blocked: false };
}

/**
 * Realistic Mock Translation Engine
 */
function translateComment(text, targetLocale) {
  const translations = {
    es: {
      "Amazing video! The sync is perfect.": "¡Impresionante video! La sincronización es perfecta.",
      "Is anyone watching this?": "¿Alguien está viendo esto?",
      "Highly secure download pipeline!": "¡Línea de descarga altamente segura!",
      "Wow, the custom player works flawlessly on my phone.": "Vaya, el reproductor personalizado funciona perfectamente en mi teléfono.",
      "Gold tier is totally worth the upgrade.": "El nivel Gold merece totalmente la pena."
    },
    fr: {
      "Amazing video! The sync is perfect.": "Vidéo incroyable! La synchronisation est parfaite.",
      "Is anyone watching this?": "Est-ce que quelqu'un regarde ça?",
      "Highly secure download pipeline!": "Pipeline de téléchargement hautement sécurisé!",
      "Wow, the custom player works flawlessly on my phone.": "Wow, le lecteur personnalisé fonctionne parfaitement sur mon téléphone.",
      "Gold tier is totally worth the upgrade.": "Le niveau Gold vaut vraiment le coup."
    },
    hi: {
      "Amazing video! The sync is perfect.": "अद्भुत वीडियो! सिंक बिल्कुल सही है।",
      "Is anyone watching this?": "क्या कोई इसे देख रहा है?",
      "Highly secure download pipeline!": "अत्यधिक सुरक्षित डाउनलोड पाइपलाइन!",
      "Wow, the custom player works flawlessly on my phone.": "वाह, कस्टम प्लेयर मेरे फोन पर त्रुटिहीन रूप से काम करता है।",
      "Gold tier is totally worth the upgrade.": "गोल्ड टियर पूरी तरह से अपग्रेड के लायक है।"
    }
  };

  const normalizedText = text.trim();
  if (translations[targetLocale] && translations[targetLocale][normalizedText]) {
    return translations[targetLocale][normalizedText];
  }

  // Fallback for custom user comments
  const languageNames = { es: 'Spanish', fr: 'French', hi: 'Hindi', en: 'English' };
  const targetLang = languageNames[targetLocale] || targetLocale.toUpperCase();
  return `[Translated to ${targetLang}]: "${text}"`;
}

// --- VALIDATION SCHEMAS ---

const commentCreateSchema = z.object({
  videoId: z.string().uuid(),
  content: z.string().min(1).max(500),
  city: z.string().min(2).max(100).optional(),
  state: z.string().min(2).max(100).optional(),
  country: z.string().min(2).max(100).optional(),
}).strict();

const commentReportSchema = z.object({
  reason: z.string().min(5).max(200)
}).strict();

// --- ROUTES ---

/**
 * Route: GET /api/comments/video/:videoId
 * Retrieve comments for a video with location privacy mask
 */
router.get('/video/:videoId', authenticateUser, authenticatedLimiter, async (req, res, next) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { videoId: req.params.videoId },
      include: {
        user: {
          select: { username: true, avatarUrl: true, subscriptionPlan: true }
        },
        likes: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Server-side location privacy enforcement
    // If shareLocation is false, mask city/state. Keep country or hide completely.
    const sanitizedComments = comments.map(c => {
      const isPublic = c.shareLocation;
      
      const likeCount = c.likes.filter(l => l.isLike).length;
      const dislikeCount = c.likes.filter(l => !l.isLike).length;
      
      // Check user's action
      const userLike = c.likes.find(l => l.userId === req.user.id);
      const userAction = userLike ? (userLike.isLike ? 'like' : 'dislike') : null;

      return {
        id: c.id,
        content: c.content,
        userId: c.userId,
        username: c.user.username,
        avatarUrl: c.user.avatarUrl,
        userPlan: c.user.subscriptionPlan,
        createdAt: c.createdAt,
        isFlagged: c.isFlagged,
        city: isPublic ? c.city : null,
        state: isPublic ? c.state : null,
        country: isPublic ? c.country : 'Hidden',
        shareLocation: c.shareLocation,
        likes: likeCount,
        dislikes: dislikeCount,
        userAction
      };
    });

    return res.status(200).json({ success: true, comments: sanitizedComments });
  } catch (err) {
    next(err);
  }
});

/**
 * Route: POST /api/comments
 * Submit a comment under moderation filters
 */
router.post('/', authenticateUser, authenticatedLimiter, validate(commentCreateSchema), async (req, res, next) => {
  const { videoId, content, city, state, country } = req.body;
  const userId = req.user.id;

  try {
    // 1. Moderate content first (reject non-compliant)
    const moderationResult = moderateContent(content);
    if (moderationResult.blocked) {
      return res.status(400).json({
        success: false,
        message: moderationResult.reason
      });
    }

    // 2. Fetch user to verify location sharing setting
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const shareLocation = user.shareLocation;

    // Create the comment row
    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        videoId,
        city: city || 'Unspecified',
        state: state || 'Unspecified',
        country: country || 'Unspecified',
        shareLocation
      },
      include: {
        user: {
          select: { username: true, avatarUrl: true, subscriptionPlan: true }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Comment posted successfully.',
      comment: {
        id: comment.id,
        content: comment.content,
        userId: comment.userId,
        username: comment.user.username,
        avatarUrl: comment.user.avatarUrl,
        userPlan: comment.user.subscriptionPlan,
        createdAt: comment.createdAt,
        isFlagged: comment.isFlagged,
        city: shareLocation ? comment.city : null,
        state: shareLocation ? comment.state : null,
        country: shareLocation ? comment.country : 'Hidden',
        shareLocation: comment.shareLocation,
        likes: 0,
        dislikes: 0,
        userAction: null
      }
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Route: POST /api/comments/:id/like
 * Upvote/Downvote comment
 */
const likeSchema = z.object({
  action: z.enum(['like', 'dislike', 'neutral'])
}).strict();

router.post('/:id/like', authenticateUser, authenticatedLimiter, validate(likeSchema), async (req, res, next) => {
  const commentId = req.params.id;
  const userId = req.user.id;
  const { action } = req.body;

  try {
    if (action === 'neutral') {
      // Delete existing interaction
      await prisma.commentLike.deleteMany({
        where: { userId, commentId }
      });
    } else {
      const isLike = action === 'like';
      // Upsert engagement record
      await prisma.commentLike.upsert({
        where: {
          userId_commentId: { userId, commentId }
        },
        update: { isLike },
        create: { userId, commentId, isLike }
      });
    }

    // Return recalculation
    const likes = await prisma.commentLike.count({ where: { commentId, isLike: true } });
    const dislikes = await prisma.commentLike.count({ where: { commentId, isLike: false } });

    return res.status(200).json({
      success: true,
      message: 'Engagement registered.',
      likes,
      dislikes,
      userAction: action === 'neutral' ? null : action
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Route: POST /api/comments/:id/report
 * Flag comments for review. Admin queues rather than autodelete.
 */
router.post('/:id/report', authenticateUser, authenticatedLimiter, validate(commentReportSchema), async (req, res, next) => {
  const commentId = req.params.id;
  const userId = req.user.id;
  const { reason } = req.body;

  try {
    // 1. Create audit report log
    await prisma.commentReport.create({
      data: {
        userId,
        commentId,
        reason
      }
    });

    // 2. Mark flagged flag in comment table
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { isFlagged: true }
    });

    return res.status(200).json({
      success: true,
      message: 'Comment has been successfully reported for admin evaluation. Thank you for keeping the community safe.',
      isFlagged: comment.isFlagged
    });

  } catch (err) {
    next(err);
  }
});

/**
 * Route: POST /api/comments/:id/translate
 * Handles inline comment translations without leaky external network tasks
 */
const translateSchema = z.object({
  targetLocale: z.enum(['en', 'es', 'fr', 'hi'])
}).strict();

router.post('/:id/translate', authenticateUser, authenticatedLimiter, validate(translateSchema), async (req, res, next) => {
  const commentId = req.params.id;
  const { targetLocale } = req.body;

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    const translatedText = translateComment(comment.content, targetLocale);

    return res.status(200).json({
      success: true,
      translatedText,
      originalText: comment.content,
      targetLocale
    });

  } catch (err) {
    next(err);
  }
});

export default router;
