const { PrismaClient } = require('@prisma/client');

function utcMidnightDaysAgo(daysAgo) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

function xorshift32(seed) {
  // returns [0,1)
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

async function main() {
  const prisma = new PrismaClient();
  const studentNo = '202512340001';
  const newName = '张天山';

  const cet4Year = 2025;
  const cet4Month = 6;
  const cet6Year = 2025;
  const cet6Month = 12;

  const cet4Total = 650;
  const cet6Total = 630;

  try {
    const student = await prisma.student.findUnique({ where: { studentNo } });
    if (!student) throw new Error(`student not found: ${studentNo}`);

    await prisma.student.update({
      where: { id: student.id },
      data: { name: newName },
    });

    const [cet4Batch, cet6Batch] = await Promise.all([
      prisma.examBatch.findUnique({
        where: { examType_year_month: { examType: 'CET4', year: cet4Year, month: cet4Month } },
      }),
      prisma.examBatch.findUnique({
        where: { examType_year_month: { examType: 'CET6', year: cet6Year, month: cet6Month } },
      }),
    ]);

    if (!cet4Batch) throw new Error(`CET4 batch not found: ${cet4Year}-${cet4Month}`);
    if (!cet6Batch) throw new Error(`CET6 batch not found: ${cet6Year}-${cet6Month}`);

    await prisma.score.upsert({
      where: { studentId_examBatchId: { studentId: student.id, examBatchId: cet4Batch.id } },
      create: {
        studentId: student.id,
        examBatchId: cet4Batch.id,
        totalScore: cet4Total,
        listeningScore: 215,
        readingScore: 220,
        writingScore: 215,
        entrySource: 'IMPORT',
      },
      update: {
        totalScore: cet4Total,
        listeningScore: 215,
        readingScore: 220,
        writingScore: 215,
        entrySource: 'IMPORT',
      },
    });

    await prisma.score.upsert({
      where: { studentId_examBatchId: { studentId: student.id, examBatchId: cet6Batch.id } },
      create: {
        studentId: student.id,
        examBatchId: cet6Batch.id,
        totalScore: cet6Total,
        listeningScore: 210,
        readingScore: 215,
        writingScore: 205,
        entrySource: 'IMPORT',
      },
      update: {
        totalScore: cet6Total,
        listeningScore: 210,
        readingScore: 215,
        writingScore: 205,
        entrySource: 'IMPORT',
      },
    });

    // Fill last 365 days with non-zero recitations (heatmap ~ full)
    const days = 365;
    let upserted = 0;
    for (let i = 0; i < days; i += 1) {
      const date = utcMidnightDaysAgo(i);
      // pseudo-random but deterministic per-day (stable seed)
      const r = xorshift32(20251234 ^ (i * 2654435761));
      // keep mostly full (always >0), but with visible variation for heatmap colors
      const words = Math.round(40 + r * 260); // 40~300
      const minutes = Math.max(5, Math.round(words / 6));
      await prisma.recitationEntry.upsert({
        where: { studentId_date: { studentId: student.id, date } },
        create: { studentId: student.id, date, words, minutes },
        update: { words, minutes },
      });
      upserted += 1;
    }

    const updatedStudent = await prisma.student.findUnique({ where: { id: student.id } });
    const scores = await prisma.score.findMany({
      where: { studentId: student.id },
      include: { examBatch: true },
      orderBy: { examBatch: { examDate: 'desc' } },
      take: 10,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          student: updatedStudent,
          updatedScores: scores.map((s) => ({
            examType: s.examBatch.examType,
            batch: s.examBatch.name,
            totalScore: s.totalScore,
          })),
          recitationsUpserted: upserted,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


