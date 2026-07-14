import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, AlertTriangle, Languages, ShieldAlert, MapPin, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CommentsSection({ videoId }) {
  const { user, token, currentLocation } = useAuth();
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [shareLocation, setShareLocation] = useState(user?.shareLocation || false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Translation tracker: commentId -> { translatedText, targetLocale, showOriginal }
  const [translations, setTranslations] = useState({});

  // Report Modal / State: commentId -> boolean
  const [reportingCommentId, setReportingCommentId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Fetch comments
  const fetchComments = async () => {
    try {
      const res = await fetch(`${API_BASE}/comments/video/${videoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (err) {
      console.error('Failed to load comments.', err);
    }
  };

  useEffect(() => {
    fetchComments();
    setErrorMsg(null);
    setTranslations({});
  }, [videoId]);

  // Submit comment
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          videoId,
          content: newComment,
          // Send location details for recording (server will mask city/state dynamically if shareLocation is off)
          city: currentLocation.city,
          state: currentLocation.state,
          country: currentLocation.country
        })
      });

      const data = await res.json();
      if (data.success) {
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
      } else {
        // Render moderation engine failure reason directly in UI
        setErrorMsg(data.message);
      }
    } catch (err) {
      setErrorMsg('Failed to connect to the community moderation server.');
    }
  };

  // Engagement trigger: upvote / downvote
  const handleLike = async (commentId, currentAction) => {
    let nextAction = 'like';
    if (currentAction === 'like') nextAction = 'neutral';

    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: nextAction })
      });
      const data = await res.json();
      if (data.success) {
        // Sync state locally
        setComments(prev => prev.map(c => {
          if (c.id === commentId) {
            return {
              ...c,
              likes: data.likes,
              dislikes: data.dislikes,
              userAction: data.userAction
            };
          }
          return c;
        }));
      }
    } catch (err) {
      console.error('Failed to like comment.', err);
    }
  };

  const handleDislike = async (commentId, currentAction) => {
    let nextAction = 'dislike';
    if (currentAction === 'dislike') nextAction = 'neutral';

    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: nextAction })
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => prev.map(c => {
          if (c.id === commentId) {
            return {
              ...c,
              likes: data.likes,
              dislikes: data.dislikes,
              userAction: data.userAction
            };
          }
          return c;
        }));
      }
    } catch (err) {
      console.error('Failed to dislike comment.', err);
    }
  };

  // Translate comment
  const handleTranslate = async (commentId, text) => {
    const targetLocale = user?.preferredLocale || 'en';
    
    // Toggle original if already translated
    if (translations[commentId]) {
      setTranslations(prev => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          showOriginal: !prev[commentId].showOriginal
        }
      }));
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetLocale })
      });
      const data = await res.json();
      if (data.success) {
        setTranslations(prev => ({
          ...prev,
          [commentId]: {
            translatedText: data.translatedText,
            targetLocale: data.targetLocale,
            showOriginal: false
          }
        }));
      }
    } catch (err) {
      alert('Translation service currently offline.');
    }
  };

  // Flag/Report comment submission
  const handleReportComment = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/comments/${reportingCommentId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reportReason })
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => prev.map(c => {
          if (c.id === reportingCommentId) {
            return { ...c, isFlagged: true };
          }
          return c;
        }));
        setReportingCommentId(null);
        setReportReason('');
        alert('Thank you. The comment has been flagged for admin audit.');
      }
    } catch (err) {
      console.error('Failed to report comment.', err);
    }
  };

  const getPlanBadgeClass = (plan) => {
    switch (plan) {
      case 'Gold': return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30';
      case 'Silver': return 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30';
      case 'Bronze': return 'bg-amber-600/20 text-amber-700 dark:text-amber-500 border border-amber-600/30';
      default: return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="flex flex-col gap-6 mt-8 p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span>Community Comments</span>
        <span className="text-xs bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 px-2 py-0.5 rounded-full font-bold">
          {comments.length}
        </span>
      </h3>

      {/* Moderation Error Feedback Box */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-400 text-xs animate-shake">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Post Blocked:</span> {errorMsg}
          </div>
        </div>
      )}

      {/* Add Comment Input Form */}
      <form onSubmit={handleSubmitComment} className="flex flex-col gap-4">
        <textarea
          placeholder="Share your thoughts... (Spam, abusive words, or character flooding will be blocked by the moderation engine)"
          rows={3}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="w-full p-4 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400"
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Location privacy controls */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShareLocation(!shareLocation)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                shareLocation 
                  ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              {shareLocation ? <MapPin className="w-3.5 h-3.5 text-green-500" /> : <Globe className="w-3.5 h-3.5" />}
              <span>{shareLocation ? 'Location Shared' : 'Location Masked'}</span>
            </button>
            
            {shareLocation && (
              <span className="text-[10px] text-slate-400 font-mono">
                Posting from: {currentLocation.city}, {currentLocation.state} (Masked on save if toggle is off)
              </span>
            )}
          </div>

          <button 
            type="submit"
            className="btn-premium px-6 py-2.5 text-sm"
          >
            Post Comment
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="flex flex-col gap-4">
        {comments.map((comment) => {
          const trans = translations[comment.id];
          const hasTrans = !!trans;
          const displayTranslation = hasTrans && !trans.showOriginal;

          return (
            <div key={comment.id} className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-300 text-xs font-bold uppercase shadow-sm">
                    {comment.username[0]}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      {comment.username}
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${getPlanBadgeClass(comment.userPlan)}`}>
                        {comment.userPlan}
                      </span>
                    </span>
                    <span className="text-[9px] text-slate-400 flex items-center gap-1">
                      {new Date(comment.createdAt).toLocaleDateString([], { dateStyle: 'medium' })} &bull;
                      <span className="flex items-center gap-0.5 font-mono">
                        <MapPin className="w-2.5 h-2.5" />
                        {comment.country}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Translate Button */}
                  <button
                    onClick={() => handleTranslate(comment.id, comment.content)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-500 rounded transition-all"
                    title="Translate comment"
                  >
                    <Languages className="w-4 h-4" />
                  </button>

                  {/* Flag / Report Button */}
                  <button
                    onClick={() => setReportingCommentId(comment.id)}
                    className={`p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-all ${
                      comment.isFlagged ? 'text-red-500' : 'text-slate-400 hover:text-red-500'
                    }`}
                    title="Report Abuse"
                    disabled={comment.isFlagged}
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Comment Content (With translation toggle) */}
              <div className="text-xs text-slate-700 dark:text-slate-300 pl-10 pr-2 leading-relaxed">
                {displayTranslation ? (
                  <div className="bg-brand-500/5 dark:bg-brand-500/10 border-l-2 border-brand-500 p-2 rounded-r-lg">
                    <p className="italic text-slate-800 dark:text-slate-100">{trans.translatedText}</p>
                    <button 
                      onClick={() => handleTranslate(comment.id)}
                      className="text-[9px] text-brand-500 hover:underline mt-1 font-bold block"
                    >
                      Show Original
                    </button>
                  </div>
                ) : (
                  <p>{comment.content}</p>
                )}
                {hasTrans && trans.showOriginal && (
                  <button 
                    onClick={() => handleTranslate(comment.id)}
                    className="text-[9px] text-brand-500 hover:underline mt-1 font-bold block"
                  >
                    Show Translation
                  </button>
                )}
              </div>

              {/* Engagement Controls */}
              <div className="flex items-center gap-4 pl-10 mt-1">
                <button
                  onClick={() => handleLike(comment.id, comment.userAction)}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold transition-all hover:scale-105 ${
                    comment.userAction === 'like' ? 'text-green-500' : 'text-slate-400 hover:text-green-500'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>{comment.likes}</span>
                </button>

                <button
                  onClick={() => handleDislike(comment.id, comment.userAction)}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold transition-all hover:scale-105 ${
                    comment.userAction === 'dislike' ? 'text-red-500' : 'text-slate-400 hover:text-red-500'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>{comment.dislikes}</span>
                </button>

                {comment.isFlagged && (
                  <span className="text-[9px] text-red-500 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-bold ml-auto flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Under Review</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Report Modal */}
      {reportingCommentId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form 
            onSubmit={handleReportComment}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-md w-full p-6 animate-scale-up"
          >
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
              <span>Report Community Comment</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Please provide a valid reason for reporting this comment. It will be immediately flagged for administrator evaluation.
            </p>
            <input
              type="text"
              placeholder="e.g. Inappropriate language, spamming, self-promotion..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500 mb-6"
              required
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReportingCommentId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-md"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
