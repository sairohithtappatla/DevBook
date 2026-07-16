import { useMemo, useRef, useState, useEffect } from "react";
import {
  Globe,
  Mail,
  Pencil,
  Check,
  X,
  MapPin,
  Briefcase,
  Camera,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useAllProfiles } from "@/hooks/useProfile";
import { PageContainer } from "@/components/layout/PageContainer";
import { BookCard, type BookData } from "@/components/books/BookCard";

export type Socials = { github: string; linkedin: string; portfolio: string; email: string };
export type ProfileData = {
  name: string;
  username?: string;
  title: string;
  location: string;
  about: string;
  avatar: string;
  socials: Socials;
  updatedAt: number;
};

const KEY = "devbook-profile-v1";
const FOLLOW_KEY = "devbook-follows-v1";

// Helper icons
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

const SOCIAL_FIELDS: {
  key: keyof Socials;
  label: string;
  icon: any;
  placeholder: string;
  href: (v: string) => string;
}[] = [
    {
      key: "github",
      label: "GitHub",
      icon: GithubIcon,
      placeholder: "https://github.com/…",
      href: (v) => v,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      icon: LinkedinIcon,
      placeholder: "https://linkedin.com/in/…",
      href: (v) => v,
    },
    {
      key: "portfolio",
      label: "Portfolio",
      icon: Globe,
      placeholder: "https://your.site",
      href: (v) => v,
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      placeholder: "you@domain.com",
      href: (v) => (v.startsWith("mailto:") ? v : `mailto:${v}`),
    },
  ];

function mapDBBookToBookData(dbBook: any): BookData {
  return {
    id: dbBook.id,
    title: dbBook.title,
    description: dbBook.description || "",
    cover_url: dbBook.cover_url || "workflow",
    steps_count: 12,
    author: {
      name: "DevBook Creator",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
    },
    created_at: dbBook.created_at,
    tags: dbBook.tags
  };
}

export function ProfilePage() {
  const { user } = useAuth();
  const { data: dbBooks = [] } = useBooks();
  const { data: dbProfiles = [] } = useAllProfiles();

  const [activeUsername, setActiveUsername] = useState<string>("me");

  // Load and sync localStorage state
  const [me, setMe] = useState<ProfileData>(() => {
    const fallback: ProfileData = {
      name: user?.profile?.name || "You",
      username: "you",
      title: "Backend engineer",
      location: "Remote",
      about: "Backend engineer, learning by shipping. Building agents, backends, and the occasional side project.",
      avatar: user?.profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
      socials: { github: "https://github.com/you", linkedin: "https://linkedin.com/in/you", portfolio: "https://you.dev", email: "you@devbook.dev" },
      updatedAt: Date.now(),
    };
    if (typeof window === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<ProfileData>;
      return {
        name: parsed.name ?? fallback.name,
        username: parsed.username ?? fallback.username,
        title: parsed.title ?? fallback.title,
        location: parsed.location ?? fallback.location,
        about: parsed.about ?? fallback.about,
        avatar: parsed.avatar ?? fallback.avatar,
        socials: { ...fallback.socials, ...(parsed.socials ?? {}) },
        updatedAt: parsed.updatedAt ?? fallback.updatedAt,
      };
    } catch {
      return fallback;
    }
  });

  const [following, setFollowing] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(FOLLOW_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });

  const updateMe = (patch: Partial<ProfileData>) => {
    const updated = {
      ...me,
      ...patch,
      socials: { ...me.socials, ...(patch.socials ?? {}) },
      updatedAt: Date.now(),
    };
    setMe(updated);
    try {
      localStorage.setItem(KEY, JSON.stringify(updated));
    } catch { }
  };

  const toggleFollow = (username: string) => {
    const has = following.includes(username);
    const updated = has ? following.filter((u) => u !== username) : [...following, username];
    setFollowing(updated);
    try {
      localStorage.setItem(FOLLOW_KEY, JSON.stringify(updated));
    } catch { }
  };

  // Derive followers and following from dbProfiles
  const otherUsers = useMemo(() => {
    return dbProfiles
      .filter((p) => p.id !== user?.id)
      .map((p) => {
        const username = (p.name || "user").toLowerCase().replace(/\s+/g, "_");
        return {
          id: p.id,
          username,
          name: p.name || "DevBook Creator",
          avatar: p.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
          about: p.bio || "Full Stack Engineer building projects.",
          bio: p.bio || "Full Stack Engineer building projects.",
          title: "Developer",
          location: "Remote",
          socials: {
            github: `https://github.com/${username}`,
            linkedin: `https://linkedin.com/in/${username}`,
            portfolio: "",
            email: "",
          },
        };
      });
  }, [dbProfiles, user?.id]);

  // Determine current active profile to view
  const currentProfile = useMemo(() => {
    if (activeUsername === "me") {
      return {
        id: user?.id || "me",
        username: me.username || "you",
        name: me.name,
        avatar: me.avatar,
        about: me.about,
        title: me.title,
        location: me.location,
        socials: me.socials,
        editable: true,
      };
    }
    const found = otherUsers.find((u) => u.username === activeUsername);
    if (found) {
      return {
        id: found.id,
        username: found.username,
        name: found.name,
        avatar: found.avatar,
        about: found.about,
        title: found.title,
        location: found.location,
        socials: found.socials,
        editable: false,
      };
    }
    return {
      id: "unknown",
      username: "unknown",
      name: "Unknown Creator",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
      about: "No bio details available.",
      title: "Creator",
      location: "Earth",
      socials: { github: "", linkedin: "", portfolio: "", email: "" },
      editable: false,
    };
  }, [activeUsername, me, otherUsers, user?.id]);

  // Published count
  const publishedCount = useMemo(() => {
    return dbBooks.filter((b) => b.created_by === currentProfile.id).length;
  }, [dbBooks, currentProfile.id]);

  // Followers list for target profile
  const followersList = useMemo(() => {
    if (activeUsername === "me") return otherUsers;
    return otherUsers.filter((p) => p.username !== activeUsername).slice(0, 3);
  }, [otherUsers, activeUsername]);

  // Following list for target profile
  const followingList = useMemo(() => {
    if (activeUsername === "me") {
      return otherUsers.filter((p) => following.includes(p.username));
    }
    return otherUsers.filter((p) => p.username !== activeUsername).slice(1, 4);
  }, [otherUsers, following, activeUsername]);

  const userBooks = useMemo(() => {
    return dbBooks
      .filter((b) => b.created_by === currentProfile.id)
      .map(mapDBBookToBookData);
  }, [dbBooks, currentProfile.id]);

  return (
    <PageContainer className="flex flex-col justify-start pb-6">
      {/* Top breadcrumbs */}
      <div className="text-xs text-text-secondary select-none font-mono flex items-center gap-1.5 opacity-80">
        <span className="hover:text-primary transition-colors cursor-pointer" onClick={() => setActiveUsername("me")}>devbook</span>
        <span className="text-text-secondary/40 font-normal">/</span>
        <span className="hover:text-primary transition-colors cursor-pointer" onClick={() => setActiveUsername("me")}>profile</span>
        <span className="text-text-secondary/40 font-normal">/</span>
        <span
          className={`transition-colors cursor-pointer ${activeUsername === "me" ? "text-text-primary font-medium" : "hover:text-primary"}`}
          onClick={() => setActiveUsername("me")}
        >
          me
        </span>
        {activeUsername !== "me" && (
          <>
            <span className="text-text-secondary/40 font-normal">/</span>
            <span className="text-text-primary font-medium">{activeUsername}</span>
          </>
        )}
      </div>

      <ProfileView
        profile={currentProfile}
        updateMe={updateMe}
        publishedCount={publishedCount}
        followers={followersList}
        following={followingList}
        toggleFollow={toggleFollow}
        followingUsernames={following}
        onSelectUser={setActiveUsername}
      />

      {userBooks.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-text-primary">Published Books</h2>
          <div className="w-full overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar flex flex-row gap-4 scroll-smooth">
            {userBooks.map((book) => (
              <div key={book.id} className="w-[280px] shrink-0 select-none">
                <BookCard book={book} />
              </div>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

// ---------- Shared view ----------

type ViewProps = {
  profile: {
    id: string;
    username: string;
    name: string;
    avatar: string;
    about: string;
    title: string;
    location: string;
    socials: Socials;
    editable: boolean;
  };
  updateMe: (patch: Partial<ProfileData>) => void;
  publishedCount: number;
  followers: { username: string; name: string; avatar: string; bio: string }[];
  following: { username: string; name: string; avatar: string; bio: string }[];
  toggleFollow: (username: string) => void;
  followingUsernames: string[];
  onSelectUser: (username: string) => void;
};

export function ProfileView({
  profile,
  updateMe,
  publishedCount,
  followers,
  following,
  toggleFollow,
  followingUsernames,
  onSelectUser,
}: ViewProps) {
  const [editing, setEditing] = useState(false);
  const [openList, setOpenList] = useState<null | "followers" | "following">(null);

  // Editable state buffers
  const [draftName, setDraftName] = useState(profile.name);
  const [draftUsername, setDraftUsername] = useState(profile.username);
  const [draftTitle, setDraftTitle] = useState(profile.title);
  const [draftLocation, setDraftLocation] = useState(profile.location);
  const [draftAbout, setDraftAbout] = useState(profile.about);
  const [draftSocials, setDraftSocials] = useState<Socials>(profile.socials);
  const [draftAvatar, setDraftAvatar] = useState(profile.avatar);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const socialErrors = useMemo(() => validateSocials(draftSocials), [draftSocials]);
  const nameError = !draftName.trim() ? "Name is required" : null;
  const usernameError = !draftUsername.trim() ? "Alias is required" : null;
  const hasErrors = Boolean(nameError) || Boolean(usernameError) || Object.values(socialErrors).some(Boolean);

  const isFollowing = followingUsernames.includes(profile.username);

  // Reset states when profile shifts (e.g. visiting other profile)
  useEffect(() => {
    setEditing(false);
    setDraftName(profile.name);
    setDraftUsername(profile.username);
    setDraftTitle(profile.title);
    setDraftLocation(profile.location);
    setDraftAbout(profile.about);
    setDraftSocials(profile.socials);
    setDraftAvatar(profile.avatar);
    setAvatarError(null);
  }, [profile]);

  function startEdit() {
    setDraftName(profile.name);
    setDraftUsername(profile.username);
    setDraftTitle(profile.title);
    setDraftLocation(profile.location);
    setDraftAbout(profile.about);
    setDraftSocials(profile.socials);
    setDraftAvatar(profile.avatar);
    setAvatarError(null);
    setEditing(true);
  }

  function saveEdit() {
    if (hasErrors) return;
    updateMe({
      name: draftName.trim(),
      username: draftUsername.trim().toLowerCase(),
      title: draftTitle.trim(),
      location: draftLocation.trim(),
      about: draftAbout.trim(),
      avatar: draftAvatar,
      socials: normalizeSocials(draftSocials),
    });
    setEditing(false);
  }

  function onPickAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraftAvatar(String(reader.result ?? ""));
      setAvatarError(null);
    };
    reader.onerror = () => setAvatarError("Could not read image.");
    reader.readAsDataURL(file);
  }

  const activeAvatar = editing ? draftAvatar : profile.avatar;

  return (
    <>
      {/* Matches BookCard's design exactly */}
      <section className="rounded-2xl border border-border bg-surface p-6 md:p-8 hover:border-primary/20 transition-all duration-150">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          {/* Left: identity */}
          <div className="flex flex-1 flex-col sm:flex-row gap-6">
            {/* Identity Image + Next-to-it Upload Camera layout */}
            <div className="flex items-center gap-4 shrink-0 mx-auto sm:mx-0">
              <img
                src={activeAvatar}
                alt={profile.name}
                className="h-24 w-24 rounded-full border border-border bg-background object-cover shrink-0"
              />
              {profile.editable && editing && (
                <div className="flex flex-col gap-2 justify-center shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface text-text-primary text-xs hover:bg-surface-secondary cursor-pointer transition-colors shadow-xs animate-in fade-in duration-200"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Upload photo</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickAvatar(e.target.files?.[0])}
                  />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              {/* Alias / Username Field */}
              {profile.editable && editing ? (
                <div className="flex items-center justify-center sm:justify-start gap-1">
                  <span className="font-mono text-xs text-text-secondary select-none">@</span>
                  <input
                    value={draftUsername}
                    onChange={(e) => setDraftUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                    placeholder="alias"
                    style={{ fontSize: "10px", fontFamily: "var(--font-code, monospace)" }}
                    className={`h-7 bg-transparent text-text-primary font-mono text-xs outline-hidden border-b border-border/80 focus:border-primary px-0 pb-0.5 transition-all ${usernameError ? "border-destructive/60" : "border-border/0"
                      }`}
                  />
                  {usernameError && (
                    <span className="text-[10px] text-destructive">{usernameError}</span>
                  )}
                </div>
              ) : (
                <div className="font-mono text-xs text-text-secondary select-none">@{profile.username}</div>
              )}

              {profile.editable && editing ? (
                <div className="mt-1.5">
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Your name"
                    style={{ fontSize: "24px", fontWeight: "700", letterSpacing: "-0.025em", lineHeight: "2rem" }}
                    className={`w-full max-w-sm bg-transparent text-text-primary text-2xl font-bold tracking-tight outline-hidden border-b border-border/80 focus:border-primary px-0 pb-1 leading-tight transition-all ${nameError ? "border-destructive/60" : "border-border/0"
                      }`}
                  />
                  {nameError && (
                    <div className="mt-1 text-xs text-destructive">{nameError}</div>
                  )}
                </div>
              ) : (
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-text-primary leading-tight">
                  {profile.name}
                </h1>
              )}

              {profile.editable && editing ? (
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <FieldInput
                    icon={<Briefcase className="h-3.5 w-3.5 text-text-secondary/60" />}
                    value={draftTitle}
                    onChange={setDraftTitle}
                    placeholder="Title (e.g. Backend engineer)"
                    max={80}
                  />
                  <FieldInput
                    icon={<MapPin className="h-3.5 w-3.5 text-text-secondary/60" />}
                    value={draftLocation}
                    onChange={setDraftLocation}
                    placeholder="Location"
                    max={80}
                  />
                </div>
              ) : (
                (profile.title || profile.location) && (
                  <div className="mt-2 flex flex-wrap justify-center sm:justify-start items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                    {profile.title && (
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-text-muted" /> {profile.title}
                      </span>
                    )}
                    {profile.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-text-muted" /> {profile.location}
                      </span>
                    )}
                  </div>
                )
              )}

              {profile.editable && editing ? (
                <div className="mt-3">
                  <textarea
                    value={draftAbout}
                    onChange={(e) => setDraftAbout(e.target.value.slice(0, 250))}
                    rows={3}
                    placeholder="Bio — a couple of lines about you"
                    style={{ fontSize: "14px", lineHeight: "1.5rem" }}
                    className="w-full max-w-xl bg-transparent text-text-secondary text-sm leading-relaxed outline-hidden border-b border-border/80 focus:border-primary px-0 py-1 resize-none transition-all"
                  />
                  <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                    {draftAbout.length}/250
                  </div>
                </div>
              ) : (
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary select-text whitespace-pre-wrap">
                  {profile.about}
                </p>
              )}
              {avatarError && (
                <div className="mt-2 text-xs text-destructive">{avatarError}</div>
              )}
            </div>
          </div>

          {/* Right: socials + actions */}
          <div className="flex w-full flex-col gap-3 md:w-64">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-widest text-text-secondary/60 select-none">
                Links
              </div>
              {profile.editable && !editing && (
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface hover:bg-surface-secondary px-2.5 py-1.5 text-xs text-text-secondary cursor-pointer transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>

            <SocialsPanel
              editing={profile.editable && editing}
              value={profile.editable && editing ? draftSocials : profile.socials}
              onChange={setDraftSocials}
              errors={profile.editable && editing ? socialErrors : undefined}
            />

            {profile.editable ? (
              editing ? (
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={hasErrors}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 px-3 py-1.5 text-xs font-bold cursor-pointer transition-all"
                  >
                    <Check className="h-3.5 w-3.5" /> Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface hover:bg-surface-secondary px-3 py-1.5 text-xs text-text-secondary cursor-pointer transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null
            ) : (
              <button
                onClick={() => toggleFollow(profile.username)}
                className={`w-full text-center rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all shadow-xs ${isFollowing
                  ? "border border-border text-text-primary bg-surface hover:bg-surface-secondary"
                  : " text hover:bg-primary/"
                  }`}
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border-light pt-6">
          <Stat
            label="Published"
            value={publishedCount}
          />
          <Stat
            label="Followers"
            value={followers.length}
            onClick={() => setOpenList("followers")}
          />
          <Stat
            label="Following"
            value={following.length}
            onClick={() => setOpenList("following")}
          />
        </div>
      </section>

      <PeopleDialog
        open={openList !== null}
        onOpenChange={(o) => !o && setOpenList(null)}
        title={openList === "followers" ? "Followers" : "Following"}
        people={openList === "followers" ? followers : following}
        toggleFollow={toggleFollow}
        followingUsernames={followingUsernames}
        onSelectUser={onSelectUser}
      />
    </>
  );
}

function Stat({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: number;
  onClick?: () => void;
}) {
  const cls =
    "relative overflow-hidden rounded-xl border border-border bg-surface px-4 py-3 text-left transition-all duration-150 select-none flex flex-col justify-between h-[80px]";

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-text-secondary/60">
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-text-primary">
        {value ?? 0}
      </div>
    </>
  );

  return onClick ? (
    <button
      onClick={onClick}
      className={`${cls} hover:border-primary/20 cursor-pointer`}
    >
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

function FieldInput({
  icon,
  value,
  onChange,
  placeholder,
  max,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  max?: number;
}) {
  return (
    <label className="flex items-center gap-1.5 bg-transparent border-b border-border/80 focus-within:border-primary transition-all py-1 px-0">
      {icon}
      <input
        value={value}
        onChange={(e) => onChange(max ? e.target.value.slice(0, max) : e.target.value)}
        placeholder={placeholder}
        style={{ fontSize: "12px" }}
        className="min-w-0 flex-1 bg-transparent text-xs outline-hidden placeholder:text-muted-foreground/60 text-text-secondary py-0 px-0"
      />
    </label>
  );
}

function SocialsPanel({
  editing,
  value,
  onChange,
  errors,
}: {
  editing: boolean;
  value: Socials;
  onChange: (s: Socials) => void;
  errors?: Record<keyof Socials, string | null>;
}) {
  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        {SOCIAL_FIELDS.map((f) => {
          const Icon = f.icon;
          const err = errors?.[f.key];
          return (
            <div key={f.key}>
              <label
                className={`flex items-center gap-2 rounded-lg border bg-surface px-3 py-1.5 focus-within:border-primary transition-all ${err ? "border-destructive/60" : "border-border"
                  }`}
              >
                <Icon className="h-3.5 w-3.5 text-text-secondary/60" />
                <input
                  value={value[f.key]}
                  onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ fontSize: "12px" }}
                  className="min-w-0 flex-1 bg-transparent text-xs outline-hidden placeholder:text-muted-foreground/60 text-text-primary"
                />
              </label>
              {err && <div className="mt-1 text-[11px] text-destructive">{err}</div>}
            </div>
          );
        })}
      </div>
    );
  }
  const items = SOCIAL_FIELDS.filter((f) => value[f.key]?.trim());
  if (items.length === 0) {
    return <div className="text-xs text-text-secondary select-none italic text-center py-4 bg-surface/50 rounded-lg border border-border/60">No links yet.</div>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((f) => {
        const Icon = f.icon;
        return (
          <li key={f.key}>
            <a
              href={f.href(value[f.key])}
              target={f.key === "email" ? undefined : "_blank"}
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs text-text-primary transition-all duration-150 hover:border-primary/30"
            >
              <Icon className="h-3.5 w-3.5 text-text-secondary/60" />
              <span className="truncate flex-1">{value[f.key]}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function PeopleDialog({
  open,
  onOpenChange,
  title,
  people,
  toggleFollow,
  followingUsernames,
  onSelectUser,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  people: { username: string; name: string; avatar: string; bio: string }[];
  toggleFollow: (username: string) => void;
  followingUsernames: string[];
  onSelectUser: (username: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div onClick={() => onOpenChange(false)} className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300" />
      <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-heading text-sm font-bold text-text-primary">{title}</h3>
          <button type="button" onClick={() => onOpenChange(false)} className="text-text-secondary hover:text-text-primary cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-hidden max-h-[60vh] flex flex-col">
          {people.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-secondary select-none">No one yet.</div>
          ) : (
            <ul className="divide-y divide-border overflow-y-auto custom-scrollbar pr-1">
              {people.map((p) => {
                const isFollowing = followingUsernames.includes(p.username);
                return (
                  <li key={p.username} className="flex items-center gap-3 py-3">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      onClick={() => {
                        onSelectUser(p.username);
                        onOpenChange(false);
                      }}
                      className="h-9 w-9 rounded-full border border-border bg-surface object-cover select-none shadow-xs cursor-pointer hover:opacity-85 transition-opacity"
                    />
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => {
                      onSelectUser(p.username);
                      onOpenChange(false);
                    }}>
                      <div className="truncate text-sm font-semibold text-text-primary hover:text-primary transition-colors">{p.name}</div>
                      <div className="truncate font-mono text-[11px] text-text-secondary select-all">
                        @{p.username}
                        {p.bio ? ` · ${p.bio}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFollow(p.username)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors shadow-xs ${isFollowing
                        ? "border border-border text-text-primary bg-background hover:border-foreground/30"
                        : "bg-background hover:border-foreground/30"
                        }`}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Validation & formatting ----------

function normalizeUrl(v: string): string {
  const t = v.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isValidHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function validateSocials(s: Socials): Record<keyof Socials, string | null> {
  const errs: Record<keyof Socials, string | null> = {
    github: null,
    linkedin: null,
    portfolio: null,
    email: null,
  };
  if (s.github.trim()) {
    const u = normalizeUrl(s.github);
    if (!isValidHttpUrl(u) || !/github\.com/i.test(u)) errs.github = "Expected a github.com URL";
  }
  if (s.linkedin.trim()) {
    const u = normalizeUrl(s.linkedin);
    if (!isValidHttpUrl(u) || !/linkedin\.com/i.test(u))
      errs.linkedin = "Expected a linkedin.com URL";
  }
  if (s.portfolio.trim()) {
    const u = normalizeUrl(s.portfolio);
    if (!isValidHttpUrl(u)) errs.portfolio = "Enter a valid URL";
  }
  if (s.email.trim() && !isValidEmail(s.email)) {
    errs.email = "Enter a valid email";
  }
  return errs;
}

export function normalizeSocials(s: Socials): Socials {
  return {
    github: s.github.trim() ? normalizeUrl(s.github) : "",
    linkedin: s.linkedin.trim() ? normalizeUrl(s.linkedin) : "",
    portfolio: s.portfolio.trim() ? normalizeUrl(s.portfolio) : "",
    email: s.email.trim(),
  };
}
