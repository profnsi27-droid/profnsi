// PROFNSI - Types partagés (frontend + backend)

export type Level = "premiere" | "terminale";

export type ExamStatus = "draft" | "open" | "closed" | "archived";

export type CopyStatus =
  | "in_progress"
  | "submitted"
  | "grading"
  | "graded"
  | "validated";

// Types de cellules de réponse autorisés pour un exercice
export type CellType = "python" | "text" | "image" | "qcm" | "table";

export interface ExerciseDef {
  id: string;
  title: string;
  /** Types de cellules autorisés pour cet exercice */
  allowedTypes: CellType[];
  /** Points sur cet exercice (somme = barème total, idéalement 20) */
  points: number;
  /** Énoncé / consigne de l'exercice (extrait du sujet ou saisi) */
  prompt: string;
  /** Options QCM le cas échéant : [{ id, label, correct }] */
  qcmOptions?: { id: string; label: string; correct: boolean }[];
  /** Structure de tableau attendue le cas échéant */
  tableColumns?: string[];
  tableRows?: number;
}

/** Une cellule de réponse élève */
export interface AnswerCell {
  id: string;
  exerciseId: string;
  type: CellType;
  // python
  code?: string;
  output?: string;
  // text
  text?: string;
  // image
  images?: { path: string; caption?: string }[];
  // qcm
  selectedOptions?: string[];
  // table
  table?: string[][]; // lignes x colonnes
  updatedAt?: string;
}

export interface AntiCheatEvent {
  type:
    | "tab_change"
    | "fullscreen_exit"
    | "focus_loss"
    | "reconnect"
    | "answer_edit"
    | "submit"
    | "start"
    | "code_run";
  ts: string;
  detail?: string;
}

export interface GradeBreakdownItem {
  exerciseId: string;
  exerciseTitle: string;
  points: number;
  max: number;
  justification: string;
  errors: string[];
}

export interface AICorrection {
  totalGrade: number;
  breakdown: GradeBreakdownItem[];
  detailedCorrection: string;
  competencies: { name: string; level: "acquis" | "partiel" | "non_acquis" }[];
  advice: string;
  needsManualReview: boolean;
  manualReviewNotes?: string;
}

export interface ExamWithCounts {
  id: string;
  title: string;
  level: Level;
  duration: number;
  scale: number;
  instructions: string | null;
  competences: string | null;
  exercises: ExerciseDef[];
  accessCode: string;
  status: ExamStatus;
  subjectPdf: string | null;
  correctionPdf: string | null;
  createdAt: string;
  updatedAt: string;
  copiesCount: number;
  submittedCount: number;
  gradedCount: number;
}

export interface CopyDetail {
  id: string;
  examId: string;
  examTitle: string;
  level: Level;
  scale: number;
  exercises: ExerciseDef[];
  studentName: string;
  studentFirstname: string;
  className: string;
  sessionId: string;
  startTime: string;
  endTime: string | null;
  status: CopyStatus;
  answers: Record<string, AnswerCell>;
  events: AntiCheatEvent[];
  grade: number | null;
  gradeBreakdown: GradeBreakdownItem[] | null;
  correction: AICorrection | null;
  correctionPdf: string | null;
  emailSent: boolean;
  emailError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  examsCount: number;
  studentsStarted: number;
  copiesReceived: number;
  correctionsPending: number;
  copiesGraded: number;
  classAverage: number | null;
  maxGrade: number | null;
  minGrade: number | null;
  gradeDistribution: { range: string; count: number }[];
}
