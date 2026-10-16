export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccessStatus = "pending" | "approved" | "blocked";
export type QAJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type QAEventStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "info";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          access_status: AccessStatus;
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          organization: string | null;
          role: string | null;
          updated_at: string;
          use_case: string | null;
        };
        Insert: {
          access_status?: AccessStatus;
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          organization?: string | null;
          role?: string | null;
          updated_at?: string;
          use_case?: string | null;
        };
        Update: {
          access_status?: AccessStatus;
          avatar_url?: string | null;
          email?: string | null;
          full_name?: string | null;
          organization?: string | null;
          role?: string | null;
          updated_at?: string;
          use_case?: string | null;
        };
        Relationships: [];
      };
      access_requests: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          organization: string | null;
          role: string | null;
          status: AccessStatus;
          updated_at: string;
          use_case: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id?: string;
          organization?: string | null;
          role?: string | null;
          status?: AccessStatus;
          updated_at?: string;
          use_case?: string | null;
          user_id?: string | null;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          organization?: string | null;
          role?: string | null;
          status?: AccessStatus;
          updated_at?: string;
          use_case?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      saved_questions: {
        Row: {
          created_at: string;
          id: string;
          question: string;
          topic_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          question: string;
          topic_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          question?: string;
          topic_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_answers: {
        Row: {
          answer_text: string;
          created_at: string;
          evidence_pmids: string[];
          id: string;
          question_id: string | null;
          system_id: string | null;
          user_id: string;
        };
        Insert: {
          answer_text: string;
          created_at?: string;
          evidence_pmids?: string[];
          id?: string;
          question_id?: string | null;
          system_id?: string | null;
          user_id: string;
        };
        Update: {
          answer_text?: string;
          evidence_pmids?: string[];
          question_id?: string | null;
          system_id?: string | null;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json;
          user_id: string;
        };
        Update: {
          event_type?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      qa_jobs: {
        Row: {
          answer_citations: Json;
          answer_text: string | null;
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          input: Json;
          last_event_at: string | null;
          question: string;
          started_at: string | null;
          status: QAJobStatus;
          system_id: string;
          updated_at: string;
          user_id: string;
          worker_id: string | null;
        };
        Insert: {
          answer_citations?: Json;
          answer_text?: string | null;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          input?: Json;
          last_event_at?: string | null;
          question: string;
          started_at?: string | null;
          status?: QAJobStatus;
          system_id?: string;
          updated_at?: string;
          user_id: string;
          worker_id?: string | null;
        };
        Update: {
          answer_citations?: Json;
          answer_text?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          input?: Json;
          last_event_at?: string | null;
          question?: string;
          started_at?: string | null;
          status?: QAJobStatus;
          system_id?: string;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      qa_events: {
        Row: {
          created_at: string;
          detail: string | null;
          id: string;
          job_id: string;
          payload: Json;
          sequence: number;
          stage: string;
          status: QAEventStatus;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          detail?: string | null;
          id?: string;
          job_id: string;
          payload?: Json;
          sequence: number;
          stage: string;
          status?: QAEventStatus;
          title: string;
          user_id: string;
        };
        Update: {
          detail?: string | null;
          payload?: Json;
          sequence?: number;
          stage?: string;
          status?: QAEventStatus;
          title?: string;
        };
        Relationships: [];
      };
      qa_sources: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          journal: string | null;
          metadata: Json;
          pmid: string | null;
          publication_year: string | null;
          source_id: string;
          source_type: string;
          snippet: string | null;
          title: string | null;
          url: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          journal?: string | null;
          metadata?: Json;
          pmid?: string | null;
          publication_year?: string | null;
          source_id: string;
          source_type?: string;
          snippet?: string | null;
          title?: string | null;
          url?: string | null;
          user_id: string;
        };
        Update: {
          journal?: string | null;
          metadata?: Json;
          pmid?: string | null;
          publication_year?: string | null;
          source_id?: string;
          source_type?: string;
          snippet?: string | null;
          title?: string | null;
          url?: string | null;
        };
        Relationships: [];
      };
      qa_workers: {
        Row: {
          current_job_id: string | null;
          error_message: string | null;
          last_seen_at: string;
          metadata: Json;
          status: string;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          current_job_id?: string | null;
          error_message?: string | null;
          last_seen_at?: string;
          metadata?: Json;
          status?: string;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          current_job_id?: string | null;
          error_message?: string | null;
          last_seen_at?: string;
          metadata?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_next_qa_job: {
        Args: {
          worker_identity?: string | null;
        };
        Returns: Database["public"]["Tables"]["qa_jobs"]["Row"][];
      };
    };
    Enums: {
      access_status: AccessStatus;
      qa_event_status: QAEventStatus;
      qa_job_status: QAJobStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type QAJob = Database["public"]["Tables"]["qa_jobs"]["Row"];
export type QAEvent = Database["public"]["Tables"]["qa_events"]["Row"];
export type QASource = Database["public"]["Tables"]["qa_sources"]["Row"];
