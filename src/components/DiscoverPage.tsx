import React, { useState, useEffect } from 'react';
import { Calendar, Heart, MessageCircle, Share2, Award, Plus, Link as LinkIcon, X, Send, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function DiscoverPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState<string | null>(null);
  
  // Create Post State
  const [postText, setPostText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Comments State
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (user) {
      const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists() && docSnap.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      });
      return () => unsubUser();
    }
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!showCommentsModal) return;
    const q = query(collection(db, 'posts', showCommentsModal, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [showCommentsModal]);

  const handleCreatePost = async () => {
    if (!user || (!postText.trim() && !mediaUrl.trim())) return;
    setIsUploading(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName || 'مستخدم',
        authorAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        text: postText.trim(),
        imageUrl: mediaUrl.trim(),
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        likedBy: []
      });

      setShowCreateModal(false);
      setPostText('');
      setMediaUrl('');
    } catch (error) {
      console.error("Error creating post:", error);
      alert("حدث خطأ أثناء نشر المنشور");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLike = async (postId: string, likedBy: string[]) => {
    if (!user) return;
    const postRef = doc(db, 'posts', postId);
    const isLiked = likedBy.includes(user.uid);
    
    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likedBy: likedBy.filter(id => id !== user.uid),
          likesCount: increment(-1)
        });
      } else {
        await updateDoc(postRef, {
          likedBy: [...likedBy, user.uid],
          likesCount: increment(1)
        });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || !showCommentsModal) return;

    const commentText = newComment.trim();
    setNewComment('');

    try {
      await addDoc(collection(db, 'posts', showCommentsModal, 'comments'), {
        authorId: user.uid,
        authorName: user.displayName || 'مستخدم',
        authorAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        text: commentText,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'posts', showCommentsModal), {
        commentsCount: increment(1)
      });
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المنشور؟')) {
      try {
        await deleteDoc(doc(db, 'posts', postId));
      } catch (error) {
        console.error("Error deleting post:", error);
        alert("حدث خطأ أثناء حذف المنشور");
      }
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50 relative pb-20">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-2 sticky top-0 z-10 shadow-sm flex justify-center border-b border-gray-100">
        <div className="flex gap-8">
          <button className="pb-2 text-sm font-bold border-b-2 border-purple-600 text-purple-600">أحدث</button>
          <button className="pb-2 text-sm font-medium text-gray-500 border-b-2 border-transparent">نشاطات</button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Posts Feed */}
        <div className="space-y-4">
          {posts.map((post) => {
            const isLiked = user && post.likedBy?.includes(user.uid);
            return (
              <div key={post.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                {/* Post Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {post.authorAvatar?.toLowerCase().includes('.mp4') ? (
                        <video src={post.authorAvatar} autoPlay loop muted playsInline className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <img src={post.authorAvatar} alt="User" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">{post.authorName}</h4>
                      <p className="text-[10px] text-gray-400">
                        {post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString('ar-EG') : 'الآن'}
                      </p>
                    </div>
                  </div>
                  {(isAdmin || (user && user.uid === post.authorId)) && (
                    <button 
                      onClick={() => handleDeletePost(post.id)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-full transition"
                      title="حذف المنشور"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                {/* Content */}
                {post.text && (
                  <p className="text-sm text-gray-700 mb-3 leading-relaxed whitespace-pre-wrap">
                    {post.text}
                  </p>
                )}

                {/* Image / Video */}
                {post.imageUrl && (
                  <div className="rounded-xl overflow-hidden mb-4 bg-gray-100">
                    {post.imageUrl.toLowerCase().includes('.mp4') ? (
                      <video src={post.imageUrl} controls className="w-full max-h-80 object-contain" />
                    ) : (
                      <img src={post.imageUrl} alt="Post content" className="w-full max-h-80 object-contain" referrerPolicy="no-referrer" />
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between text-gray-500 border-t border-gray-50 pt-3">
                  <button 
                    onClick={() => handleLike(post.id, post.likedBy || [])}
                    className={`flex items-center gap-1.5 transition ${isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                  >
                    <Heart size={18} className={isLiked ? 'fill-current' : ''} />
                    <span className="text-xs">{post.likesCount || 0}</span>
                  </button>
                  <button 
                    onClick={() => setShowCommentsModal(post.id)}
                    className="flex items-center gap-1.5 hover:text-purple-500 transition"
                  >
                    <MessageCircle size={18} />
                    <span className="text-xs">{post.commentsCount || 0}</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-blue-500 transition">
                    <Share2 size={18} />
                    <span className="text-xs">مشاركة</span>
                  </button>
                </div>
              </div>
            );
          })}
          
          {posts.length === 0 && (
            <div className="text-center py-10 text-gray-500 text-sm">
              لا توجد منشورات حتى الآن. كن أول من ينشر!
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button 
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-20 left-4 w-14 h-14 bg-purple-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-purple-700 transition-transform hover:scale-105 z-40"
      >
        <Plus size={28} />
      </button>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">إنشاء منشور جديد</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="بم تفكر؟"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none mb-4"
              dir="auto"
            />

            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="رابط الصورة أو الفيديو (MP4)..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4 text-left"
              dir="ltr"
            />

            {mediaUrl && (
              <div className="relative mb-4 rounded-xl overflow-hidden bg-gray-100 h-40">
                {mediaUrl.toLowerCase().includes('.mp4') ? (
                  <video src={mediaUrl} controls className="w-full h-full object-contain" />
                ) : (
                  <img src={mediaUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
                <button 
                  onClick={() => setMediaUrl('')}
                  className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button 
                onClick={handleCreatePost}
                disabled={isUploading || (!postText.trim() && !mediaUrl.trim())}
                className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? <Loader2 size={20} className="animate-spin" /> : 'نشر'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
          <div className="bg-white w-full h-[75vh] rounded-t-3xl flex flex-col shadow-2xl animate-slide-up">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">التعليقات</h2>
              <button onClick={() => setShowCommentsModal(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  {comment.authorAvatar?.toLowerCase().includes('.mp4') ? (
                    <video src={comment.authorAvatar} autoPlay loop muted playsInline className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <img src={comment.authorAvatar} alt="User" className="w-8 h-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                  )}
                  <div className="bg-gray-50 rounded-2xl rounded-tr-none p-3 flex-1">
                    <h4 className="text-xs font-bold text-gray-800 mb-1">{comment.authorName}</h4>
                    <p className="text-sm text-gray-700">{comment.text}</p>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleString('ar-EG') : 'الآن'}
                    </span>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <div className="text-center py-10 text-gray-500 text-sm">
                  لا توجد تعليقات بعد. كن أول من يعلق!
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white">
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="اكتب تعليقاً..."
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  dir="auto"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-purple-700 transition shrink-0"
                >
                  <Send size={18} className="mr-1" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
