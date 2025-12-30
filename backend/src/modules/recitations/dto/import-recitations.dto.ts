export type ImportRecitationRecordDto = {
  studentNo: string;
  studentName?: string;
  className?: string;
  date: string; // YYYY-MM-DD
  words: number;
  minutes?: number;
  note?: string;
};

export type ImportRecitationsDto =
  | {
      records: ImportRecitationRecordDto[];
    }
  | {
      students: Array<{
        studentNo: string;
        name: string;
        className?: string;
        daily: Record<string, number>;
      }>;
    };




