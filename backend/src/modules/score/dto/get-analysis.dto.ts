import type { ExamType } from '@prisma/client';

export interface GetAnalysisQueryDto {
  examBatchId?: string;
  examType?: ExamType;
  year?: string;
  month?: string;
  passLine?: string;
}

