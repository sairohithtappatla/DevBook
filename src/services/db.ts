import { insforge } from "@/lib/insforge";

export interface DBUser {
  id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export interface DBBook {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  publication_status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  access_level: "PUBLIC" | "FOLLOWERS" | "SELECTED" | "PRIVATE";
  estimated_read_time: number;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  tags: string[];
  created_by: string | null;
}

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
    const existing = await this.getProfile(userId);
    if (!existing) {
      const { data, error } = await insforge.database
        .from("users")
        .insert({ id: userId, ...updates })
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await insforge.database
        .from("users")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // --- BOOKS ---
  async getBooks(): Promise<DBBook[]> {
    const { data, error } = await insforge.database
      .from("books")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      const defaultSeedBooks = [
        {
          title: "Workflow Engine",
          slug: "workflow-engine",
          description: "Build a production ready workflow engine from scratch.",
          cover_url: "workflow",
          publication_status: "PUBLISHED",
          access_level: "PUBLIC",
          estimated_read_time: 120,
          difficulty: "INTERMEDIATE",
          tags: ["Backend", "Architecture"]
        },
        {
          title: "Authentication System",
          slug: "authentication-system",
          description: "Implement JWT auth, roles, permissions & more.",
          cover_url: "auth",
          publication_status: "PUBLISHED",
          access_level: "PUBLIC",
          estimated_read_time: 90,
          difficulty: "BEGINNER",
          tags: ["Backend", "Security"]
        },
        {
          title: "E-commerce Backend",
          slug: "ecommerce-backend",
          description: "A complete backend for an e-commerce platform.",
          cover_url: "ecommerce",
          publication_status: "PUBLISHED",
          access_level: "PUBLIC",
          estimated_read_time: 180,
          difficulty: "ADVANCED",
          tags: ["Backend", "Database"]
        }
      ];

      const inserted: DBBook[] = [];
      for (const b of defaultSeedBooks) {
        const { data: bData } = await insforge.database.from("books").insert(b).select().single();
        if (bData) {
          inserted.push(bData);
          const { data: pData } = await insforge.database.from("phases").insert({
            book_id: bData.id,
            title: "Phase 1 - Initialization",
            position: 1
          }).select().single();

          if (pData) {
            await insforge.database.from("steps").insert({
              phase_id: pData.id,
              title: "1.1 Introduction",
              position: 1,
              content: {
                slug: "introduction",
                markdown: "# Introduction\n\nWelcome to " + bData.title + ". Let's build something scalable!",
                description: "Getting started with the project.",
                status: "Published",
                difficulty: "Beginner",
                estimatedTime: 10,
                visibility: "Public"
              }
            });
            await insforge.database.from("steps").insert({
              phase_id: pData.id,
              title: "1.2 Setup Project",
              position: 2,
              content: {
                slug: "setup",
                markdown: "# Setup Project\n\nConfigure your environment and start coding.",
                description: "Setting up workspace variables.",
                status: "Published",
                difficulty: "Beginner",
                estimatedTime: 15,
                visibility: "Public"
              }
            });
          }
        }
      }
      return inserted;
    }
    return data || [];
  },

  async getBook(bookId: string): Promise<DBBook | null> {
    const { data, error } = await insforge.database
      .from("books")
      .select("*")
      .eq("id", bookId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getBookBySlug(slug: string): Promise<DBBook | null> {
    const { data, error } = await insforge.database
      .from("books")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createBook(book: Omit<DBBook, "id" | "created_by">): Promise<DBBook> {
    const { data } = await insforge.auth.getCurrentUser();
    const user = data?.user;
    const { data: inserted, error } = await insforge.database
      .from("books")
      .insert({ ...book, created_by: user?.id })
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
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", bookId);
    if (error) throw error;
  },

  async getBookStructure(bookId: string) {
    const phases = await this.getPhases(bookId);
    const result = [];
    for (const p of phases) {
      const steps = await this.getSteps(p.id);
      result.push({
        id: p.id,
        title: p.title,
        steps: steps.map(s => ({
          id: s.id,
          title: s.title,
          slug: s.content.slug || "",
          markdown: s.content.markdown || "",
          description: s.content.description || "",
          status: s.content.status || "Draft",
          difficulty: s.content.difficulty || "Beginner",
          estimatedTime: s.content.estimatedTime || 10,
          visibility: s.content.visibility || "Public"
        }))
      });
    }
    return result;
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
    const { data, error } = await insforge.database
      .from("phases")
      .insert(phase)
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
    const { data, error } = await insforge.database
      .from("steps")
      .insert(step)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStep(stepId: string, updates: Partial<Omit<DBStep, "id" | "phase_id">>): Promise<DBStep> {
    const { data, error } = await insforge.database
      .from("steps")
      .update(updates)
      .eq("id", stepId)
      .select()
      .single();
    if (error) throw error;
    return data;
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
      .insert({ user_id: userId, book_id: bookId, progress_percentage: 0 })
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
  }
};
