import type { ExamType, ScoreEntrySource } from '@prisma/client';

export type ImportExamBatchRef =
  | {
      id: string;
    }
  | {
      examType: ExamType;
      year: number;
      month: number;
      name?: string;
      examDate: string;
    };

export interface ImportScoreItemDto {
  studentNo: string;
  studentName: string;
  school?: string;
  major?: string;
  className?: string;
  idCard?: string;

  totalScore: number;
  listeningScore?: number;
  readingScore?: number;
  writingScore?: number;
  oralScore?: number;

  entrySource?: ScoreEntrySource;
  ocrImageUrl?: string;
  ocrRawJson?: unknown;
}

export interface ImportScoresDto {
  examBatch: ImportExamBatchRef;
  createdById?: string;
  defaultEntrySource?: ScoreEntrySource;
  items: ImportScoreItemDto[];
}

