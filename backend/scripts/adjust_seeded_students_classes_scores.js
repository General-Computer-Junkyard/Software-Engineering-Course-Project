const { PrismaClient } = require('@prisma/client');

function xorshift32(seed) {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

async function main() {
  const prisma = new PrismaClient();

  // This range matches backend/scripts/seed_500_students.js
  const baseNo = 202512360001;
  const count = 500;
  const seededNos = Array.from({ length: count }, (_, i) => String(baseNo + i));

  // Target: 8 existing classes + 2 AI classes
  const classPool = [
    '计科 1 班',
    '计科 2 班',
    '计科 3 班',
    '软工 1 班',
    '软工 2 班',
    '软工 3 班',
    '信安 1 班',
    '信安 2 班',
    '人工智能 1 班',
    '人工智能 2 班',
  ];

  const zhangNo = '202512340001'; // 张天山

  const now = new Date();
  const year = now.getUTCFullYear();
  const cet4Month = 6;
  const cet6Month = 12;

  const [cet4Batch, cet6Batch] = await prisma.$transaction([
    prisma.examBatch.findUnique({
      where: { examType_year_month: { examType: 'CET4', year, month: cet4Month } },
    }),
    prisma.examBatch.findUnique({
      where: { examType_year_month: { examType: 'CET6', year, month: cet6Month } },
    }),
  ]);

  if (!cet4Batch) throw new Error(`CET4 batch not found: ${year}-${cet4Month}`);
  if (!cet6Batch) throw new Error(`CET6 batch not found: ${year}-${cet6Month}`);

  const students = await prisma.student.findMany({
    where: { studentNo: { in: seededNos } },
    select: { id: true, studentNo: true },
  });

  let updatedStudents = 0;
  let updatedCet4 = 0;
  let upsertedCet6 = 0;
  let deletedCet6 = 0;

  await prisma.$transaction(async (tx) => {
    // 1) Re-assign classes for the 500 seeded students
    for (const s of students) {
      const seed = Number.parseInt(s.studentNo.slice(-6), 10) || 123456;
      // use modulo to ensure even distribution across classes
      const idx = Math.abs(seed) % classPool.length;
      const className = classPool[idx] || classPool[0];
      await tx.student.update({ where: { id: s.id }, data: { className } });
      updatedStudents += 1;

      // 2) Make CET4 have reasonable pass rate (not all fail)
      // Target distribution: 360~690 (mean ~525), so most pass but still some fail
      const r4 = xorshift32(seed ^ 0x11111111);
      const total4 = Math.max(220, Math.min(710, Math.round(360 + r4 * 330)));
      await tx.score.upsert({
        where: { studentId_examBatchId: { studentId: s.id, examBatchId: cet4Batch.id } },
        create: {
          studentId: s.id,
          examBatchId: cet4Batch.id,
          totalScore: total4,
          listeningScore: Math.round(total4 * 0.33),
          readingScore: Math.round(total4 * 0.34),
          writingScore: Math.round(total4 * 0.33),
          entrySource: 'IMPORT',
        },
        update: {
          totalScore: total4,
          listeningScore: Math.round(total4 * 0.33),
          readingScore: Math.round(total4 * 0.34),
          writingScore: Math.round(total4 * 0.33),
          entrySource: 'IMPORT',
        },
      });
      updatedCet4 += 1;

      // 3) CET6: only if CET4 >= 425; otherwise remove CET6 score if exists
      const eligible = total4 >= 425;
      if (eligible) {
        const r6 = xorshift32(seed ^ 0x22222222);
        const total6 = Math.max(240, Math.min(710, Math.round(330 + r6 * 300)));
        await tx.score.upsert({
          where: { studentId_examBatchId: { studentId: s.id, examBatchId: cet6Batch.id } },
          create: {
            studentId: s.id,
            examBatchId: cet6Batch.id,
            totalScore: total6,
            listeningScore: Math.round(total6 * 0.33),
            readingScore: Math.round(total6 * 0.34),
            writingScore: Math.round(total6 * 0.33),
            entrySource: 'IMPORT',
          },
          update: {
            totalScore: total6,
            listeningScore: Math.round(total6 * 0.33),
            readingScore: Math.round(total6 * 0.34),
            writingScore: Math.round(total6 * 0.33),
            entrySource: 'IMPORT',
          },
        });
        upsertedCet6 += 1;
      } else {
        const del = await tx.score.deleteMany({
          where: { studentId: s.id, examBatchId: cet6Batch.id },
        });
        deletedCet6 += del.count;
      }
    }

    // 4) Move 张天山 to AI class (do NOT change his recitations/scores)
    const z = await tx.student.findUnique({ where: { studentNo: zhangNo }, select: { id: true } });
    if (z) {
      await tx.student.update({ where: { id: z.id }, data: { className: '人工智能 1 班', name: '张天山' } });
    }
  });

  // quick aggregates
  const countsByClass = await prisma.student.groupBy({
    by: ['className'],
    where: { OR: [{ studentNo: { in: seededNos } }, { studentNo: zhangNo }] },
    _count: { _all: true },
    orderBy: { className: 'asc' },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        year,
        updatedStudents,
        updatedCet4,
        upsertedCet6,
        deletedCet6,
        classCounts: countsByClass.map((c) => ({ className: c.className ?? '未分班', count: c._count._all })),
        note: '已将500名学生分布到8个原班级 + 2个人工智能班，并把张天山挪到人工智能 1 班；四级成绩改为有明显通过率分布。',
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


