import { useState, useEffect } from "react";
import { useToast } from "@/providers/ToastProvider";
import { MapPin, Link as LinkIcon, Calendar, Users, Eye, Pencil, Star, X, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" rx="1" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

type ProfileBook = {
  id: string;
  title: string;
  description: string;
  stepsCount: number;
  stars: number;
  status: string;
  coverType: "workflow" | "auth" | "ecommerce" | "aws" | "python";
};

const mockPublishedBooks: ProfileBook[] = [
  {
    id: "1",
    title: "Workflow Engine",
    description: "Build a production ready workflow engine from scratch.",
    stepsCount: 24,
    stars: 128,
    status: "Published",
    coverType: "workflow"
  },
  {
    id: "2",
    title: "Authentication System",
    description: "Implement JWT auth, roles, permissions & more.",
    stepsCount: 18,
    stars: 94,
    status: "Published",
    coverType: "auth"
  },
  {
    id: "3",
    title: "E-commerce Backend",
    description: "A complete backend for an e-commerce platform.",
    stepsCount: 31,
    stars: 82,
    status: "Published",
    coverType: "ecommerce"
  }
];

const mockFollowers = [
  { name: "Rohith", handle: "@rohith_dev", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80", bio: "Software Engineer @ InsForge. Love backend systems." },
  { name: "Ananya", handle: "@ananya_codes", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80", bio: "Tech Lead, Author. JavaScript advocate." },
  { name: "Vamsi", handle: "@vamsi_aws", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&q=80", bio: "Cloud Solutions Architect. AWS Certified." }
];

const mockFollowing = [
  { name: "Sai Kiran", handle: "@kiran_dev", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80", bio: "E-commerce system developer and database tutor." },
  { name: "Meera", handle: "@meera_api", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80", bio: "FastAPI contributor, Python fanatic." }
];

function BookCoverSVG({ type }: { type: ProfileBook["coverType"] }) {
  switch (type) {
    case "workflow":
      return (
        <div className="w-[48px] h-[38px] rounded bg-[#2A1F45] flex items-center justify-center border border-border/10 overflow-hidden shrink-0 select-none">
          <svg className="w-full h-full p-1" viewBox="0 0 100 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="25" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
            <rect x="42" y="10" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
            <rect x="42" y="40" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
            <rect x="74" y="25" width="16" height="16" rx="4" fill="#9333EA" fillOpacity="0.8" />
            <path d="M26 33 H42" stroke="#A855F7" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M58 18 H74" stroke="#A855F7" strokeWidth="2" />
            <path d="M58 48 H74" stroke="#A855F7" strokeWidth="2" />
          </svg>
        </div>
      );
    case "auth":
      return (
        <div className="w-[48px] h-[38px] rounded bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] flex items-center justify-center border border-blue-100 overflow-hidden shrink-0 select-none">
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" fillOpacity="0.1" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      );
    case "ecommerce":
      return (
        <div className="w-[48px] h-[38px] rounded bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] flex items-center justify-center border border-green-100 overflow-hidden shrink-0 select-none">
          <svg className="w-4 h-4 text-[#2E7D32]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
      );
    case "aws":
      return (
        <div className="w-[48px] h-[38px] rounded bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] flex items-center justify-center border border-orange-100 overflow-hidden shrink-0 select-none">
          <svg className="w-4 h-4 text-[#EF6C00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
          </svg>
        </div>
      );
    case "python":
      return (
        <div className="w-[48px] h-[38px] rounded bg-gradient-to-br from-[#FFFDE7] to-[#FFF9C4] flex items-center justify-center border border-yellow-100 overflow-hidden shrink-0 select-none">
          <svg className="w-4 h-4 text-[#EAB308]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" fillOpacity="0.1" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}

export function ProfilePage() {
  const { user } = useAuth();
  const { data: dbProfile } = useProfile(user?.id);
  const updateProfileMutation = useUpdateProfile();

  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"books" | "followers" | "following">("books");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 4; // paginating 2 items per page to show pagination

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const getTabItems = () => {
    if (activeTab === "books") return mockPublishedBooks;
    if (activeTab === "followers") return mockFollowers;
    if (activeTab === "following") return mockFollowing;
    return [];
  };

  const currentItems = getTabItems();
  const totalPages = Math.ceil(currentItems.length / pageSize);
  const visibleItems = currentItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const [profile, setProfile] = useState({
    name: "Rohith Tappatla",
    username: "@rohith",
    bio: "Full Stack Engineer building developer education tools. Passionate about design systems, React, and system architecture. Curating the best AI roadmaps on DevBook.",
    location: "Hyderabad, India",
    website: "rohith.dev",
    followers: 128,
    following: 94,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
  });

  const [formState, setFormState] = useState({ ...profile });

  useEffect(() => {
    if (dbProfile) {
      const updated = {
        name: dbProfile.name || user?.profile?.name || "DevBook User",
        username: `@${user?.email?.split("@")[0] || "user"}`,
        bio: dbProfile.bio || "No bio yet. Edit profile to add one!",
        location: "Hyderabad, India",
        website: "devbook.app",
        followers: 128,
        following: 94,
        avatar: dbProfile.avatar_url || user?.profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
      };
      setProfile(updated);
      setFormState(updated);
    }
  }, [dbProfile, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        updates: {
          name: formState.name,
          bio: formState.bio,
          avatar_url: formState.avatar
        }
      });
      setProfile(formState);
      setIsEditOpen(false);
      showToast("Profile updated successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Error updating profile", "error");
    }
  };

  return (
    <div className="page-content-container my-books-page profile-page select-none">
      <div className="space-y-3">
        {/* 1. Header Profile Banner Card */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs relative -mt-6 md:-mt-8">
          {/* Decorative Cover */}
          <div className="h-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15" style={{
              backgroundImage: "radial-gradient(circle, #fff 10%, transparent 11%)",
              backgroundSize: "20px 20px"
            }} />
          </div>

          {/* Profile Details Container */}
          <div className="px-4 pb-4 pt-2 relative flex flex-col md:flex-row md:items-end justify-between gap-4">
            {/* Avatar overlapping cover */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full border-2 border-surface -mt-6 overflow-hidden shrink-0 shadow-sm relative bg-surface select-none">
                <img
                  src={profile.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex flex-col gap-0.5 mt-2">
                <h2 className="font-heading text-lg font-bold text-text-primary leading-tight">{profile.name}</h2>
                <span className="text-xs text-text-secondary">{profile.username}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0 md:mb-1">
              <button
                onClick={() => {
                  setFormState({ ...profile });
                  setIsEditOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg bg-surface hover:bg-surface-secondary text-xs font-semibold text-text-primary cursor-pointer transition-all"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>

          {/* Bio & Metadata Section */}
          <div className="px-4 pb-4 border-t border-border/40 pt-3 bg-[#FAFAFA]/40 dark:bg-transparent flex flex-col md:flex-row justify-between gap-6">
            <div className="space-y-3.5 flex-1 min-w-0">
              <p className="text-[13px] text-text-secondary max-w-2xl font-body leading-relaxed select-text">
                {profile.bio}
              </p>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-text-muted" />
                  <span>{profile.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-text-muted" />
                  <span>Joined May 2025</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                  <Users className="w-3.5 h-3.5 text-text-muted" />
                  <span>{profile.followers} Followers</span>
                  <span className="text-text-muted font-normal">•</span>
                  <span>{profile.following} Following</span>
                </div>
              </div>
            </div>

            {/* Links Section beside bio */}
            <div className="flex flex-wrap md:flex-col items-start gap-x-4 gap-y-2 shrink-0 md:border-l md:border-border/40 md:pl-6 min-w-[200px]">
              <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11.5px] text-text-secondary hover:text-text-primary transition-colors">
                <GithubIcon className="w-4 h-4 text-text-muted" />
                <span>@rohith</span>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11.5px] text-text-secondary hover:text-text-primary transition-colors">
                <LinkedinIcon className="w-4 h-4 text-text-muted" />
                <span>/in/rohith</span>
              </a>
              <a href={`https://${profile.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11.5px] text-text-secondary hover:text-primary transition-colors">
                <LinkIcon className="w-4 h-4 text-text-muted" />
                <span>{profile.website}</span>
              </a>
              <a href="mailto:rohith@devbook.com" className="flex items-center gap-2 text-[11.5px] text-text-secondary hover:text-text-primary transition-colors">
                <Mail className="w-4 h-4 text-text-muted" />
                <span>rohith@devbook.com</span>
              </a>
            </div>
          </div>
        </div>

        {/* 2. Sub-Tab Selector Navigation */}
        <div className="tabs-filters-row">
          <div className="tabs-list custom-scrollbar">
            {[
              { id: "books", label: "Published Books", count: mockPublishedBooks.length },
              { id: "followers", label: "Followers", count: profile.followers },
              { id: "following", label: "Following", count: profile.following }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
              >
                {tab.label}
                <span className="tab-count">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Tab Contents */}
        <div className="space-y-3">
          {activeTab === "books" && (
            visibleItems.map((book: any) => (
              <div
                key={book.id}
                className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-xs transition-shadow duration-150"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <BookCoverSVG type={book.coverType} />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <h3 className="font-heading text-[14px] font-bold text-text-primary truncate">
                      {book.title}
                    </h3>
                    <p className="text-[12px] text-text-secondary truncate">
                      {book.description}
                    </p>
                    <span className="text-[10px] text-text-muted mt-0.5">
                      {book.stepsCount} Steps
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-border/50">
                  <div className="flex items-center gap-1.5 text-text-secondary text-[11.5px] font-semibold">
                    <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                    <span>{book.stars}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="h-8 px-4 rounded-md border border-border hover:bg-surface-secondary text-text-primary text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {activeTab === "followers" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleItems.map((f: any, idx: number) => (
                <div key={idx} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <img src={f.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-text-primary leading-none">{f.name}</h4>
                      <span className="text-[10px] text-text-secondary">{f.handle}</span>
                      <p className="text-[11px] text-text-secondary mt-1">{f.bio}</p>
                    </div>
                  </div>
                  <button className="h-7 px-3 rounded-lg border border-border text-xs font-semibold text-text-primary hover:bg-surface-secondary cursor-pointer transition-colors shrink-0">
                    Follow Back
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === "following" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleItems.map((f: any, idx: number) => (
                <div key={idx} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <img src={f.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-text-primary leading-none">{f.name}</h4>
                      <span className="text-[10px] text-text-secondary">{f.handle}</span>
                      <p className="text-[11px] text-text-secondary mt-1">{f.bio}</p>
                    </div>
                  </div>
                  <button className="h-7 px-3 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-[#FEE2E2] hover:text-danger cursor-pointer transition-colors shrink-0">
                    Unfollow
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="pagination-row">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="pag-btn"
            >
              <ChevronLeft className="pag-icon" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`pag-btn ${currentPage === page ? "active" : ""}`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="pag-btn"
            >
              <ChevronRight className="pag-icon" />
            </button>
          </div>
        )}
      </div>

      {/* Edit Profile Modal Dialog */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div onClick={() => setIsEditOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-xs" />
          <form onSubmit={handleSaveProfile} className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-heading text-sm font-bold text-text-primary">Edit Profile</h3>
              <button type="button" onClick={() => setIsEditOpen(false)} className="text-text-secondary hover:text-text-primary cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="w-full h-9 px-3 border border-border rounded-lg bg-surface text-text-primary text-xs focus:outline-hidden focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Bio</label>
                <textarea
                  rows={3}
                  value={formState.bio}
                  onChange={(e) => setFormState({ ...formState, bio: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-primary text-xs focus:outline-hidden focus:border-primary resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Location</label>
                <input
                  type="text"
                  value={formState.location}
                  onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                  className="w-full h-9 px-3 border border-border rounded-lg bg-surface text-text-primary text-xs focus:outline-hidden focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Website Link</label>
                <input
                  type="text"
                  value={formState.website}
                  onChange={(e) => setFormState({ ...formState, website: e.target.value })}
                  className="w-full h-9 px-3 border border-border rounded-lg bg-surface text-text-primary text-xs focus:outline-hidden focus:border-primary"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-[#FAFAFA]/50 dark:bg-transparent">
              <button type="button" onClick={() => setIsEditOpen(false)} className="h-8 px-3 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-surface-secondary cursor-pointer transition-colors">
                Cancel
              </button>
              <button type="submit" className="h-8 px-4 rounded-lg bg-[#111827] hover:bg-black text-white text-xs font-semibold cursor-pointer transition-colors">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
