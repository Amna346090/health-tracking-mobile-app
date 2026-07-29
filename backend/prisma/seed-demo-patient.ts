import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

const DEMO_EMAIL = 'demo.patient@example.com';
const DEMO_PASSWORD = 'DemoPass123!';

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { patientProfile: true },
  });
  if (existing) {
    if (existing.patientProfile) {
      await prisma.medicationLog.deleteMany({
        where: { assignment: { patientId: existing.patientProfile.id } },
      });
      await prisma.medicationAssignment.deleteMany({ where: { patientId: existing.patientProfile.id } });
    }
    await prisma.healthLog.deleteMany({ where: { createdById: existing.id } });
    await prisma.photo.deleteMany({ where: { uploadedById: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
    console.log('Removed previous demo.patient record');
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      role: 'PATIENT',
      firstName: 'Alex',
      lastName: 'Morgan',
    },
  });

  const profile = await prisma.patientProfile.create({
    data: {
      userId: user.id,
      dateOfBirth: new Date('1988-06-15'),
      gender: 'FEMALE',
      healthIssue: 'Weight Management',
      avatarUrl: 'https://i.pravatar.cc/300?img=32',
      phone: '+1-555-0100',
      address: '100 Wellness Way, Springfield',
    },
  });

  const medication = await prisma.medication.create({
    data: {
      name: 'Semaglutide',
      dosage: '0.5mg',
      form: 'INJECTION',
      quantityPerDose: 1,
      foodInstruction: 'EITHER',
      instructions: 'Inject subcutaneously once weekly',
    },
  });

  const assignment = await prisma.medicationAssignment.create({
    data: {
      patientId: profile.id,
      medicationId: medication.id,
      frequency: 'WEEKLY',
      timesOfDay: ['09:00'],
      startDate: daysAgo(27),
      active: true,
    },
  });

  const startWeight = 82.4;
  const weightTrend = -0.25; // steady, encouraging downward trend
  const feelings = ['GOOD', 'GREAT', 'GOOD', 'GREAT', 'OKAY', 'GOOD', 'GREAT'] as const;

  for (let i = 27; i >= 0; i--) {
    const dayIndex = 27 - i;
    const weight = Math.round((startWeight + weightTrend * dayIndex) * 10) / 10;
    const feeling = feelings[dayIndex % feelings.length];

    await prisma.healthLog.create({
      data: {
        patientId: profile.id,
        date: daysAgo(i),
        weight,
        feeling,
        notes: dayIndex % 5 === 0 ? 'Feeling steady, energy is up.' : undefined,
        createdById: user.id,
        createdAt: daysAgo(i),
      },
    });

    if (dayIndex % 7 === 0) {
      await prisma.medicationLog.create({
        data: {
          assignmentId: assignment.id,
          userId: user.id,
          status: 'TAKEN',
          takenAt: daysAgo(i),
        },
      });
    }
  }

  const demoPhotos = [
    { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=800&fit=crop', daysAgo: 27, caption: 'Starting point — day 1' },
    { url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=800&fit=crop', daysAgo: 14, caption: 'Two weeks in, feeling great' },
    { url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=800&fit=crop', daysAgo: 0, caption: 'Today' },
  ];
  for (const photo of demoPhotos) {
    await prisma.photo.create({
      data: {
        patientId: profile.id,
        url: photo.url,
        caption: photo.caption,
        uploadedById: user.id,
        uploadedAt: daysAgo(photo.daysAgo),
      },
    });
  }

  console.log(`Demo patient ready — id ${profile.id}`);
  console.log(`Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
