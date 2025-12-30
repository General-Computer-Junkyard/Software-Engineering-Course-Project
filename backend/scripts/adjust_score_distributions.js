const { PrismaClient } = require('@prisma/client');

// stable PRNG: mulberry32
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sampleUniform(prng, min, max) {
  return min + prng() * (max - min);
}

/**
 * 四级：目标均分≈500，方差大（卷的卷、摆的摆）
 * - 15%: 250~400
 * - 60%: 400~580
 * - 25%: 580~710
 */
function sampleCet4Total(seed) {
  const prng = mulberry32(seed ^ 0x11111111);
  const r = prng();
  if (r < 0.15) return Math.round(sampleUniform(prng, 250, 400));
  if (r < 0.75) return Math.round(sampleUniform(prng, 400, 580));
  return Math.round(sampleUniform(prng, 580, 710));
}

/**
 * 六级：目标均分≈430，方差大
 * - 25%: 260~380
 * - 60%: 380~500
 * - 15%: 500~650
 */
function sampleCet6Total(seed) {
  const prng = mulberry32(seed ^ 0x22222222);
  const r = prng();
  if (r < 0.25) return Math.round(sampleUniform(prng, 260, 380));
  if (r < 0.85) return Math.round(sampleUniform(prng, 380, 500));
  return Math.round(sampleUniform(prng, 500, 650));
}

function splitScores(total, seed) {
  // deterministic split with small wobble but sums back to total
  const wobblePrng = mulberry32(seed ^ 0x44444444);
  const wobble = (wobblePrng() - 0.5) * 0.04; // +-2%
  const l = Math.round(total * (0.33 + wobble));
  const r = Math.round(total * 0.34);
  const w = total - l - r;
  return {
    listeningScore: clamp(l, 0, 710),
    readingScore: clamp(r, 0, 710),
    writingScore: clamp(w, 0, 710),
  };
}

async function main() {
  const prisma = new PrismaClient();
  const protectedStudentNo = '202512340001'; // 张天山

  const now = new Date();
  const year = now.getUTCFullYear();
  const cet4Month = 6;
  const cet6Month = 12;

  try {
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
      select: { id: true, studentNo: true },
    });

    let updatedCet4 = 0;
    let upsertedCet6 = 0;
    let deletedCet6 = 0;

    // chunk transactions to avoid oversized single transaction
    const chunkSize = 200;
    for (let start = 0; start < students.length; start += chunkSize) {
      const chunk = students.slice(start, start + chunkSize);
      await prisma.$transaction(async (tx) => {
        for (const s of chunk) {
          if (s.studentNo === protectedStudentNo) continue;

          const seed = Number.parseInt(s.studentNo.slice(-6), 10) || 123456;

          // CET4: mixture distribution around 500 with large variance
          const total4 = clamp(sampleCet4Total(seed), 220, 710);
          const parts4 = splitScores(total4, seed ^ 0x44444444);

          await tx.score.upsert({
            where: { studentId_examBatchId: { studentId: s.id, examBatchId: cet4Batch.id } },
            create: {
              studentId: s.id,
              examBatchId: cet4Batch.id,
              totalScore: total4,
              ...parts4,
              entrySource: 'IMPORT',
            },
            update: {
              totalScore: total4,
              ...parts4,
              entrySource: 'IMPORT',
            },
          });
          updatedCet4 += 1;

          // CET6: only if CET4 >= 425 (keep business logic)
          const eligible = total4 >= 425;
          if (eligible) {
            const total6 = clamp(sampleCet6Total(seed), 240, 710);
            const parts6 = splitScores(total6, seed ^ 0x55555555);
            await tx.score.upsert({
              where: { studentId_examBatchId: { studentId: s.id, examBatchId: cet6Batch.id } },
              create: {
                studentId: s.id,
                examBatchId: cet6Batch.id,
                totalScore: total6,
                ...parts6,
                entrySource: 'IMPORT',
              },
              update: {
                totalScore: total6,
                ...parts6,
                entrySource: 'IMPORT',
              },
            });
            upsertedCet6 += 1;
          } else {
            const del = await tx.score.deleteMany({ where: { studentId: s.id, examBatchId: cet6Batch.id } });
            deletedCet6 += del.count;
          }
        }
      });
    }

    // verify: compute weighted avg using raw scores
    const [cet4Agg, cet6Agg] = await Promise.all([
      prisma.score.aggregate({
        where: { examBatchId: cet4Batch.id },
        _avg: { totalScore: true },
        _count: { _all: true },
      }),
      prisma.score.aggregate({
        where: { examBatchId: cet6Batch.id },
        _avg: { totalScore: true },
        _count: { _all: true },
      }),
    ]);

    console.log(
      JSON.stringify(
        {
          ok: true,
          protectedStudentNo,
          targets: {
            cet4ApproxAvg: 500,
            cet6ApproxAvg: 430,
            note: '使用分段混合分布以获得更大方差与可控均值',
          },
          updatedCet4,
          upsertedCet6,
          deletedCet6,
          afterAgg: {
            cet4: { count: cet4Agg._count._all, avg: cet4Agg._avg.totalScore },
            cet6: { count: cet6Agg._count._all, avg: cet6Agg._avg.totalScore },
          },
          note: '已按伪随机正态分布重置成绩：四级均分≈500、六级均分≈430；张天山保持不变。',
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


