'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share2, Flame } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ActivityPost {
  id: string;
  user_id: string;
  activity_type: string;
  activity_value: number;
  activity_unit: string;
  description?: string;
  competition_id?: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url?: string;
    avatar?: string;
  };
  competition?: {
    id: string;
    name: string;
  };
  is_liked?: boolean;
}

export default function ActivityFeedPage() {
  const { user } = useAuth();
  const supabase = createBrowserClient();
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  const [followingPosts, setFollowingPosts] = useState<ActivityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.id) {
      fetchPosts();
    }
  }, [user?.id]);

  const fetchPosts = async () => {
    try {
      if (!user?.id) return;

      // Fetch all activity posts
      const { data: allPosts, error: allError } = await supabase
        .from('activity_posts')
        .select(`
          *,
          user:profiles!activity_posts_user_id_fkey(
            id,
            first_name,
            last_name,
            photo_url,
            avatar
          ),
          competition:competitions!left(
            id,
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!allError && allPosts) {
        setPosts(allPosts);

        // Check which posts the user has liked
        const { data: likes } = await supabase
          .from('activity_post_likes')
          .select('activity_post_id')
          .eq('user_id', user.id);

        const likedIds = new Set((likes || []).map(l => l.activity_post_id));
        setLikedPostIds(likedIds);
      }

      // Fetch posts from users that current user follows
      const { data: fposts, error: followError } = await supabase
        .from('activity_posts')
        .select(`
          *,
          user:profiles!activity_posts_user_id_fkey(
            id,
            first_name,
            last_name,
            photo_url,
            avatar
          ),
          competition:competitions!left(
            id,
            name
          )
        `)
        .in('user_id', await getFollowingUserIds())
        .order('created_at', { ascending: false })
        .limit(50);

      if (!followError && fposts) {
        setFollowingPosts(fposts);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching activity posts:', error);
      setLoading(false);
    }
  };

  const getFollowingUserIds = async (): Promise<string[]> => {
    if (!user?.id) return [];

    const { data } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id);

    return (data || []).map(f => f.following_id);
  };

  const handleLikePost = async (postId: string) => {
    if (!user?.id) return;

    try {
      const isLiked = likedPostIds.has(postId);

      if (isLiked) {
        await supabase
          .from('activity_post_likes')
          .delete()
          .eq('activity_post_id', postId)
          .eq('user_id', user.id);

        const newLiked = new Set(likedPostIds);
        newLiked.delete(postId);
        setLikedPostIds(newLiked);
      } else {
        await supabase
          .from('activity_post_likes')
          .insert({
            activity_post_id: postId,
            user_id: user.id
          });

        const newLiked = new Set(likedPostIds);
        newLiked.add(postId);
        setLikedPostIds(newLiked);
      }

      // Refresh to update like count
      fetchPosts();
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const getActivityEmoji = (activityType: string): string => {
    const emojiMap: { [key: string]: string } = {
      weight: '⚖️',
      steps: '👟',
      distance: '🏃',
      calories: '🔥',
      workout: '💪',
      run: '🏃',
      walk: '🚶',
    };
    return emojiMap[activityType.toLowerCase()] || '📊';
  };

  const PostCard = ({ post }: { post: ActivityPost }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={post.user?.photo_url || post.user?.avatar} />
              <AvatarFallback>
                {post.user?.first_name?.charAt(0)}{post.user?.last_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">
                {post.user?.first_name} {post.user?.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(post.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          {post.competition && (
            <Badge variant="outline" className="text-xs">
              {post.competition.name}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {post.activity_value}
            </span>
            <span className="text-lg font-semibold text-muted-foreground">
              {post.activity_unit}
            </span>
            <span className="text-2xl">{getActivityEmoji(post.activity_type)}</span>
          </div>
          {post.description && (
            <p className="text-sm text-muted-foreground">{post.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground border-t">
          <button
            onClick={() => handleLikePost(post.id)}
            className="flex items-center gap-1 hover:text-red-500 transition-colors"
          >
            <Heart
              className="h-4 w-4"
              fill={likedPostIds.has(post.id) ? 'currentColor' : 'none'}
            />
            <span>{post.like_count}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
            <MessageCircle className="h-4 w-4" />
            <span>{post.comment_count}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-green-500 transition-colors ml-auto">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
        <p className="text-muted-foreground mt-2">
          See what your friends and competition members are accomplishing
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All Activity ({posts.length})</TabsTrigger>
          <TabsTrigger value="following">Following ({followingPosts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No activity posts yet. Be the first to share your achievements!
              </CardContent>
            </Card>
          ) : (
            posts.map(post => <PostCard key={post.id} post={post} />)
          )}
        </TabsContent>

        <TabsContent value="following" className="space-y-4 mt-4">
          {followingPosts.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No posts from users you follow. Follow more users to see their activity!
              </CardContent>
            </Card>
          ) : (
            followingPosts.map(post => <PostCard key={post.id} post={post} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
