import type { AccessLevel } from "@/lib/access-level";
import { insforge } from "@/lib/insforge";
import { parseReaderTree, treeStepIds, type ReaderTree } from "@/lib/reader-tree";
import { mergeStepContent } from "@/lib/step-content";

export interface DBUser {
  id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export interface DBAttachment {
  id: string;
  step_id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  file_size: number | null;
  created_at?: string;
  created_by?: string | null;
}

export interface DBBookMember {
  book_id: string;
  user_id: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  joined_at?: string;
  user?: DBUser;
}

export interface DBBook {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  publication_status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  access_level: AccessLevel;
  estimated_read_time: number;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  tags: string[];
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  creator?: DBUser | null;
}

type DBPhaseWithSteps = {
  book_id: string;
  steps?: { id: string }[] | null;
};

export interface DBPhase {
  id: string;
  book_id: string;
  title: string;
  position: number;
}

export interface DBStep {
  id: string;
  phase_id: string;
  title: string;
  position: number;
  content: {
    slug?: string;
    markdown?: string;
    publishedMarkdown?: string;
    description?: string;
    status?: "Published" | "Draft" | "Archived";
    difficulty?: "Beginner" | "Intermediate" | "Advanced";
    estimatedTime?: number;
    visibility?: "Public" | "Followers" | "Selected" | "Private";
  };
}


export const DBService = {
  // --- USER PROFILE ---
  async getProfile(userId: string): Promise<DBUser | null> {
    const { data, error } = await insforge.database
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, updates: Partial<Omit<DBUser, "id">>): Promise<DBUser> {
    const { data, error } = await insforge.database
      .from("users")
      .upsert({ id: userId, ...updates })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAllProfiles(): Promise<DBUser[]> {
    const { data, error } = await insforge.database
      .from("users")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // --- BOOKS ---
  async getBooks(): Promise<DBBook[]> {
    const { data, error } = await insforge.database
      .from("books")
      .select("*, creator:users!books_created_by_fkey(*)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getBook(bookId: string): Promise<DBBook | null> {
    const { data, error } = await insforge.database
      .from("books")
      .select("*, creator:users!books_created_by_fkey(*)")
      .eq("id", bookId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getBookBySlug(slug: string): Promise<DBBook | null> {
    const { data, error } = await insforge.database
      .from("books")
      .select("*, creator:users!books_created_by_fkey(*)")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createBook(book: Omit<DBBook, "id" | "created_by">): Promise<DBBook> {
    const { data } = await insforge.auth.getCurrentUser();
    const user = data?.user;
    console.log("DBService.createBook: getCurrentUser result:", user);
    const { data: inserted, error } = await insforge.database
      .from("books")
      .insert([{ ...book, created_by: user?.id }])
      .select()
      .single();
    if (error) throw error;
    return inserted;
  },

  async updateBook(bookId: string, updates: Partial<Omit<DBBook, "id">>): Promise<DBBook> {
    const { data, error } = await insforge.database
      .from("books")
      .update(updates)
      .eq("id", bookId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteBook(bookId: string): Promise<void> {
    const { error } = await insforge.database
      .from("books")
      .delete()
      .eq("id", bookId);
    if (error) throw error;
  },

  // Step counts. Default = what any reader may see (view reader_book_step_counts: published steps of discoverable books).
  // includeDrafts = true also counts unpublished steps for people who may view drafts (OWNER/EDITOR/REVIEWER): the
  // base-table embed is only populated for them, so the per-book maximum of both numbers is used.
  async getStepCounts(bookIds: string[], opts: { includeDrafts?: boolean } = {}): Promise<Record<string, number>> {
    if (bookIds.length === 0) return {};
    const { data: viewRows, error: viewError } = await insforge.database
      .from("reader_book_step_counts")
      .select("book_id, step_count")
      .in("book_id", bookIds);
    if (viewError) throw viewError;
    const counts: Record<string, number> = {};
    for (const r of (viewRows || []) as { book_id: string; step_count: number }[]) {
      counts[r.book_id] = r.step_count || 0;
    }
    if (opts.includeDrafts) {
      const { data, error } = await insforge.database
        .from("phases")
        .select("book_id, steps(id)")
        .in("book_id", bookIds);
      if (error) throw error;
      const withDrafts: Record<string, number> = {};
      for (const p of (data || []) as DBPhaseWithSteps[]) {
        withDrafts[p.book_id] = (withDrafts[p.book_id] || 0) + (p.steps?.length || 0);
      }
      for (const [id, n] of Object.entries(withDrafts)) counts[id] = Math.max(counts[id] || 0, n);
    }
    return counts;
  },

  // The reader's single read: book + creator + visible phases/steps (+ attachments) from reader_book_tree.
  // includeDrafts only has an effect for OWNER/EDITOR/REVIEWER; the function ignores it for everyone else.
  async getReaderTree(bookId: string, includeDrafts = true): Promise<ReaderTree | null> {
    const { data, error } = await insforge.database.rpc("reader_book_tree", {
      target_book_id: bookId,
      include_drafts: includeDrafts,
    });
    if (error) throw error;
    return parseReaderTree(data);
  },

  async getBookStructure(bookId: string, isReaderView = false) {
    const phases = await this.getPhases(bookId);
    if (phases.length === 0) return [];

    const phaseIds = phases.map((p) => p.id);
    const { data: allSteps, error } = await insforge.database
      .from("steps")
      .select("*")
      .in("phase_id", phaseIds)
      .order("position", { ascending: true });

    if (error) throw error;

    const stepsByPhase = (allSteps || []).reduce((acc: Record<string, DBStep[]>, s: DBStep) => {
      if (!acc[s.phase_id]) acc[s.phase_id] = [];
      acc[s.phase_id].push(s);
      return acc;
    }, {});

    return phases.map((p) => {
      const steps = stepsByPhase[p.id] || [];
      return {
        id: p.id,
        title: p.title,
        steps: steps.map((s: DBStep) => {
          const publishedMd = s.content?.publishedMarkdown;
          const currentMd = s.content?.markdown || "";
          return {
            id: s.id,
            title: s.title,
            slug: s.content?.slug || "",
            markdown: isReaderView && publishedMd !== undefined ? publishedMd : currentMd,
            publishedMarkdown: publishedMd,
            description: s.content?.description || "",
            status: s.content?.status || "Draft",
            difficulty: s.content?.difficulty || "Beginner",
            estimatedTime: s.content?.estimatedTime || 10,
            visibility: s.content?.visibility || "Public"
          };
        })
      };
    });
  },

  // --- PHASES ---
  async getPhases(bookId: string): Promise<DBPhase[]> {
    const { data, error } = await insforge.database
      .from("phases")
      .select("*")
      .eq("book_id", bookId)
      .order("position", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createPhase(phase: Omit<DBPhase, "id">): Promise<DBPhase> {
    const existing = await this.getPhases(phase.book_id);
    const maxPos = existing.reduce((max, p) => Math.max(max, p.position || 0), 0);
    const nextPhase = { ...phase, position: maxPos + 1 };

    const { data, error } = await insforge.database
      .from("phases")
      .insert([nextPhase])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updatePhase(phaseId: string, updates: Partial<Omit<DBPhase, "id" | "book_id">>): Promise<DBPhase> {
    const { data, error } = await insforge.database
      .from("phases")
      .update(updates)
      .eq("id", phaseId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deletePhase(phaseId: string): Promise<void> {
    const { error } = await insforge.database
      .from("phases")
      .delete()
      .eq("id", phaseId);
    if (error) throw error;
  },

  // --- STEPS ---
  async getSteps(phaseId: string): Promise<DBStep[]> {
    const { data, error } = await insforge.database
      .from("steps")
      .select("*")
      .eq("phase_id", phaseId)
      .order("position", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createStep(step: Omit<DBStep, "id">): Promise<DBStep> {
    const existing = await this.getSteps(step.phase_id);
    const maxPos = existing.reduce((max, s) => Math.max(max, s.position || 0), 0);
    const nextStep = { ...step, position: maxPos + 1 };

    const { data, error } = await insforge.database
      .from("steps")
      .insert([nextStep])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // `updates.content` is MERGED into the step's current server content (keys not sent keep their server value), so a draft
  // save can never delete or roll back `publishedMarkdown`. The write is a compare-and-set on the trigger-maintained
  // `updated_at`: if someone saved in between, the fresh row is re-read and merged again (bounded), never overwritten blindly.
  async updateStep(stepId: string, updates: Partial<Omit<DBStep, "id" | "phase_id">>): Promise<DBStep> {
    if (updates.content === undefined) {
      const { data, error } = await insforge.database
        .from("steps")
        .update(updates)
        .eq("id", stepId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: current, error: readError } = await insforge.database
        .from("steps")
        .select("content, updated_at")
        .eq("id", stepId)
        .single();
      if (readError) throw readError;
      const content = mergeStepContent(current.content, updates.content as Record<string, unknown>);
      const { data, error } = await insforge.database
        .from("steps")
        .update({ ...updates, content })
        .eq("id", stepId)
        .eq("updated_at", current.updated_at)
        .select();
      if (error) throw error;
      if (data && data.length === 1) return data[0];
    }
    throw new Error("The step was changed elsewhere while saving. Reload the editor and try again.");
  },

  async deleteStep(stepId: string): Promise<void> {
    const { error } = await insforge.database
      .from("steps")
      .delete()
      .eq("id", stepId);
    if (error) throw error;
  },

  // --- PROGRESS ---
  async getBookProgress(userId: string, bookId: string) {
    const { data, error } = await insforge.database
      .from("book_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async startBookProgress(userId: string, bookId: string) {
    const existing = await this.getBookProgress(userId, bookId);
    if (existing) return existing;
    const { data, error } = await insforge.database
      .from("book_progress")
      .insert([{ user_id: userId, book_id: bookId, progress_percentage: 0 }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateBookProgress(userId: string, bookId: string, updates: { progress_percentage: number; last_read_step_id?: string | null }) {
    const { data, error } = await insforge.database
      .from("book_progress")
      .update(updates)
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getStepProgresses(userId: string): Promise<{ step_id: string; status: string }[]> {
    const { data, error } = await insforge.database
      .from("step_progress")
      .select("step_id, status")
      .eq("user_id", userId);
    if (error) throw error;
    return data || [];
  },

  async updateStepProgress(userId: string, stepId: string, status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED") {
    const { data, error } = await insforge.database
      .from("step_progress")
      .upsert({ user_id: userId, step_id: stepId, status })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async resetBookProgress(userId: string, bookId: string): Promise<void> {
    // Step ids come from the same function the reader uses (drafts included for people who may see them), because
    // non-draft readers can no longer select from `phases` -> `steps` directly.
    const stepIds = treeStepIds(await this.getReaderTree(bookId, true));
    if (stepIds.length > 0) {
      const { error: spError } = await insforge.database
        .from("step_progress")
        .delete()
        .eq("user_id", userId)
        .in("step_id", stepIds);
      if (spError) throw spError;
    }

    const { error: bpError } = await insforge.database
      .from("book_progress")
      .delete()
      .eq("user_id", userId)
      .eq("book_id", bookId);
    if (bpError) throw bpError;
  },

  // --- FOLLOWERS & FOLLOWING ---
  async getFollowers(userId: string): Promise<DBUser[]> {
    const { data, error } = await insforge.database
      .from("user_followers")
      .select("users!user_followers_follower_id_fkey(*)")
      .eq("following_id", userId);
    if (error) throw error;
    return (data || []).map((x: any) => x.users).filter(Boolean);
  },

  async getFollowing(userId: string): Promise<DBUser[]> {
    const { data, error } = await insforge.database
      .from("user_followers")
      .select("users!user_followers_following_id_fkey(*)")
      .eq("follower_id", userId);
    if (error) throw error;
    return (data || []).map((x: any) => x.users).filter(Boolean);
  },

  async followUser(followerId: string, followingId: string): Promise<void> {
    const { error } = await insforge.database
      .from("user_followers")
      .insert([{ follower_id: followerId, following_id: followingId }]);
    if (error) throw error;
  },

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const { error } = await insforge.database
      .from("user_followers")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    if (error) throw error;
  },

  // --- ATTACHMENTS ---
  async getAttachments(stepId: string): Promise<DBAttachment[]> {
    const { data, error } = await insforge.database
      .from("attachments")
      .select("*")
      .eq("step_id", stepId);
    if (error) throw error;
    return data || [];
  },

  async createAttachment(attachment: Omit<DBAttachment, "id">): Promise<DBAttachment> {
    const { data, error } = await insforge.database
      .from("attachments")
      .insert([attachment])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAttachment(attachmentId: string): Promise<void> {
    const { error } = await insforge.database
      .from("attachments")
      .delete()
      .eq("id", attachmentId);
    if (error) throw error;
  },

  // --- BOOK COLLABORATION ---
  async getBookMembers(bookId: string): Promise<DBBookMember[]> {
    const { data, error } = await insforge.database
      .from("book_members")
      .select("*, users:user_id(*)")
      .eq("book_id", bookId);
    if (error) throw error;
    return data || [];
  },

  async addBookMember(bookId: string, userId: string, role: "OWNER" | "EDITOR" | "VIEWER"): Promise<DBBookMember> {
    const { data, error } = await insforge.database
      .from("book_members")
      .insert([{ book_id: bookId, user_id: userId, role }])
      .select("*, users:user_id(*)")
      .single();
    if (error) throw error;
    return data;
  },

  async removeBookMember(bookId: string, userId: string): Promise<void> {
    const { error } = await insforge.database
      .from("book_members")
      .delete()
      .eq("book_id", bookId)
      .eq("user_id", userId);
    if (error) throw error;
  }
};
