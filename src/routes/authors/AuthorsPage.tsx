import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useAllProfiles } from "@/hooks/useProfile";
import { useFollowing, useFollowUser, useUnfollowUser } from "@/hooks/useFollow";
import { useToast } from "@/hooks/useToast";
import { useNavigate } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { Loader2, User, ExternalLink } from "lucide-react";

export function AuthorsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const { data: dbProfiles = [], isLoading: isLoadingProfiles } = useAllProfiles();
  const { data: dbBooks = [], isLoading: isLoadingBooks } = useBooks();
  const { data: myFollowing = [], isLoading: isLoadingFollowing } = useFollowing(user?.id);

  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const parseBio = (dbProfile: any) => {
    let username = (dbProfile?.name || "user").toLowerCase().replace(/\s+/g, "_");
    try {
      if (dbProfile?.bio?.startsWith("{")) {
        const parsed = JSON.parse(dbProfile.bio);
        username = parsed.username || username;
      }
    } catch (e) {
      // Ignore
    }
    return username;
  };

  const followingUsernames = useMemo(() => {
    return myFollowing.map((p) => parseBio(p));
  }, [myFollowing]);

  const authors = useMemo(() => {
    return dbProfiles.map((profile) => {
      const booksCount = dbBooks.filter((b) => b.created_by === profile.id).length;
      const username = parseBio(profile);
      return {
        id: profile.id,
        name: profile.name || "DevBook User",
        username,
        avatar_url: profile.avatar_url,
        booksCount,
      };
    });
  }, [dbProfiles, dbBooks]);

  const toggleFollow = (authorId: string, authorUsername: string, authorName: string) => {
    if (!user?.id) return;
    if (authorId === user.id) return;

    const isFollowing = followingUsernames.includes(authorUsername);
    if (isFollowing) {
      unfollowMutation.mutate({ followerId: user.id, followingId: authorId }, {
        onSuccess: () => {
          showToast(`Unfollowed ${authorName} successfully`, "success");
        },
        onError: (err: any) => {
          showToast(`Failed to unfollow: ${err.message || err}`, "error");
        }
      });
    } else {
      followMutation.mutate({ followerId: user.id, followingId: authorId }, {
        onSuccess: () => {
          showToast(`Following ${authorName} successfully`, "success");
        },
        onError: (err: any) => {
          showToast(`Failed to follow: ${err.message || err}`, "error");
        }
      });
    }
  };

  const isLoading = isLoadingProfiles || isLoadingBooks || isLoadingFollowing;

  return (
    <PageContainer className="flex flex-col justify-start pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Authors</h1>
          <p className="text-sm text-text-secondary mt-1">Discover and follow content creators on DevBook.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-text-secondary text-sm mt-3 font-medium">Loading authors list...</p>
        </div>
      ) : (
        <div className="border border-border bg-surface rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-secondary/40 select-none">
                  <th className="p-4 text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">Author</th>
                  <th className="p-4 text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">Books Published</th>
                  <th className="p-4 text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">Follow Status</th>
                  <th className="p-4 text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {authors.map((author) => {
                  const isMe = author.id === user?.id;
                  const isFollowing = followingUsernames.includes(author.username);

                  return (
                    <tr key={author.id} className="hover:bg-surface-secondary/20 transition-colors">
                      <td className="p-4">
                        <div 
                          onClick={() => navigate({ to: "/profile", search: { username: author.username } })}
                          className="flex items-center gap-3 cursor-pointer group w-fit"
                        >
                          {author.avatar_url ? (
                            <img
                              src={author.avatar_url}
                              alt={author.name}
                              className="w-9 h-9 rounded-full object-cover border border-border group-hover:border-primary/50 transition-colors"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-surface-secondary text-text-primary border border-border flex items-center justify-center font-heading font-semibold text-sm group-hover:border-primary/50 transition-colors">
                              {author.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-sans text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                              {author.name}
                            </div>
                            <div className="font-mono text-xs text-text-secondary select-all">
                              @{author.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-sans text-sm text-text-primary font-medium">
                        {author.booksCount} {author.booksCount === 1 ? "book" : "books"}
                      </td>
                      <td className="p-4">
                        {isMe ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-secondary text-text-secondary select-none font-mono">
                            <User className="w-3 h-3" /> You
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleFollow(author.id, author.username, author.name)}
                            disabled={followMutation.isPending || unfollowMutation.isPending}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all shadow-xs ${
                              isFollowing
                                ? "border border-border text-text-primary bg-surface hover:bg-surface-secondary"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                            } disabled:opacity-50`}
                          >
                            {isFollowing ? "Unfollow" : "Follow"}
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => navigate({ to: "/profile", search: { username: author.username } })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface hover:bg-surface-secondary px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer transition-colors shadow-xs"
                        >
                          <span>View Profile</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
