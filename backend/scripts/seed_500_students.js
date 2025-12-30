const { PrismaClient } = require('@prisma/client');

function xorshift32(seed) {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleUniform(prng, min, max) {
  return min + prng() * (max - min);
}

function sampleCet4Total(seed) {
  const prng = mulberry32(seed ^ 0x11111111);
  const r = prng();
  if (r < 0.15) return Math.round(sampleUniform(prng, 250, 400));
  if (r < 0.75) return Math.round(sampleUniform(prng, 400, 580));
  return Math.round(sampleUniform(prng, 580, 710));
}

function sampleCet6Total(seed) {
  const prng = mulberry32(seed ^ 0x22222222);
  const r = prng();
  if (r < 0.25) return Math.round(sampleUniform(prng, 260, 380));
  if (r < 0.85) return Math.round(sampleUniform(prng, 380, 500));
  return Math.round(sampleUniform(prng, 500, 650));
}

function utcMidnightDaysAgo(daysAgo) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

async function main() {
  const prisma = new PrismaClient();

  const protectedStudentNo = '202512340001'; // 张天山（不要改）
  const count = 500;
  const days = 120; // 每人最近120天背诵记录（稀疏）

  // 选一个不太会冲突的学号段；即便重复也会 skipDuplicates
  const baseNo = 202512360001;

  // 班级池：8个常见班 + 2个人工智能班（总10个，避免“一个班500人”）
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

  const now = new Date();
  const year = now.getUTCFullYear();
  const cet4Month = 6;
  const cet6Month = 12;
  const cet4ExamDate = new Date(Date.UTC(year, cet4Month - 1, 15, 0, 0, 0, 0));
  const cet6ExamDate = new Date(Date.UTC(year, cet6Month - 1, 15, 0, 0, 0, 0));

  const [cet4Batch, cet6Batch] = await prisma.$transaction([
    prisma.examBatch.upsert({
      where: { examType_year_month: { examType: 'CET4', year, month: cet4Month } },
      create: {
        examType: 'CET4',
        year,
        month: cet4Month,
        name: `CET4-${year}-${String(cet4Month).padStart(2, '0')}`,
        examDate: cet4ExamDate,
      },
      update: { examDate: cet4ExamDate },
    }),
    prisma.examBatch.upsert({
      where: { examType_year_month: { examType: 'CET6', year, month: cet6Month } },
      create: {
        examType: 'CET6',
        year,
        month: cet6Month,
        name: `CET6-${year}-${String(cet6Month).padStart(2, '0')}`,
        examDate: cet6ExamDate,
      },
      update: { examDate: cet6ExamDate },
    }),
  ]);

  // 1) createMany students
  const studentsData = [];
  for (let i = 0; i < count; i += 1) {
    const studentNo = String(baseNo + i);
    if (studentNo === protectedStudentNo) continue;
    const r = xorshift32((baseNo + i) ^ 0x9e3779b9);
    const className = classPool[Math.floor(r * classPool.length)] || classPool[0];
    studentsData.push({
      studentNo,
      name: `学生${String(i + 1).padStart(3, '0')}`,
      className,
    });
  }

  const created = await prisma.student.createMany({
    data: studentsData,
    skipDuplicates: true,
  });

  // 2) fetch IDs
  const studentNos = studentsData.map((s) => s.studentNo);
  const students = await prisma.student.findMany({
    where: { studentNo: { in: studentNos } },
    select: { id: true, studentNo: true, className: true },
  });

  // 3) build scores + recitations for these students
  const scoresCet4 = [];
  const scoresCet6 = [];
  const recitations = [];
  const startDate = utcMidnightDaysAgo(days - 1);

  for (const s of students) {
    if (s.studentNo === protectedStudentNo) continue;
    const seedBase = Number.parseInt(s.studentNo.slice(-6), 10) || 123456;

    // CET4: mean ~500 with large variance
    const total4 = Math.max(220, Math.min(710, sampleCet4Total(seedBase)));
    scoresCet4.push({
      studentId: s.id,
      examBatchId: cet4Batch.id,
      totalScore: total4,
      listeningScore: Math.round(total4 * 0.33),
      readingScore: Math.round(total4 * 0.34),
      writingScore: Math.round(total4 * 0.33),
      entrySource: 'IMPORT',
    });

    const eligible = total4 >= 425;
    if (eligible) {
      const total6 = Math.max(240, Math.min(710, sampleCet6Total(seedBase)));
      scoresCet6.push({
        studentId: s.id,
        examBatchId: cet6Batch.id,
        totalScore: total6,
        listeningScore: Math.round(total6 * 0.33),
        readingScore: Math.round(total6 * 0.34),
        writingScore: Math.round(total6 * 0.33),
        entrySource: 'IMPORT',
      });
    }

    // Recitations: last N days, ~60% active days; words 0~320 with variety
    for (let d = 0; d < days; d += 1) {
      const rr = xorshift32(seedBase ^ (d * 2654435761));
      if (rr < 0.4) continue; // 60% active
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + d);
      const words = Math.round(20 + rr * 300); // 20~320
      const minutes = Math.max(5, Math.round(words / 6));
      recitations.push({
        studentId: s.id,
        date,
        words,
        minutes,
      });
    }
  }

  // 4) write scores + recitations in batches
  const scoreRes4 = await prisma.score.createMany({ data: scoresCet4, skipDuplicates: true });
  const scoreRes6 = await prisma.score.createMany({ data: scoresCet6, skipDuplicates: true });

  const batchSize = 5000;
  let recCreated = 0;
  for (let i = 0; i < recitations.length; i += batchSize) {
    const chunk = recitations.slice(i, i + batchSize);
    const r = await prisma.recitationEntry.createMany({ data: chunk, skipDuplicates: true });
    recCreated += r.count;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        protectedStudentNo,
        studentsCreateManyCount: created.count,
        studentsFetched: students.length,
        cet4ScoresInserted: scoreRes4.count,
        cet6ScoresInserted: scoreRes6.count,
        recitationsInserted: recCreated,
        examBatches: [
          { id: cet4Batch.id, name: cet4Batch.name },
          { id: cet6Batch.id, name: cet6Batch.name },
        ],
        note: '只新增/补充其他学生的数据；不会改动张天山。',
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


