import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

async function main() {
  // ─── Remove Amna's leftover test account ─────────────────────────────────
  const amna = await prisma.user.findUnique({ where: { email: 'amnahamid346090@gmail.com' } });
  if (amna) {
    await prisma.user.delete({ where: { id: amna.id } });
    console.log('Deleted existing user amnahamid346090@gmail.com');
  }

  const staff = await prisma.user.findUnique({ where: { email: 'staff@example.com' } });
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const dummyPatients = [
    {
      email: 'john.carter@example.com',
      firstName: 'John',
      lastName: 'Carter',
      dateOfBirth: new Date('1985-04-12'),
      gender: 'MALE' as const,
      healthIssue: 'Hypertension',
      avatarUrl: 'https://i.pravatar.cc/300?img=13',
      phone: '+1-555-0142',
      address: '221 Baker Street, Springfield',
      medication: {
        name: 'Lisinopril',
        dosage: '10mg',
        form: 'TABLET' as const,
        quantityPerDose: 1,
        foodInstruction: 'EITHER' as const,
        instructions: 'Take with water in the morning',
      },
      startWeight: 92.5,
      weightTrend: -0.3, // losing weight over time
      feelings: ['GOOD', 'OKAY', 'GOOD', 'GREAT', 'OKAY', 'GOOD', 'GREAT'] as const,
      doseAdherence: 0.85, // mostly taken, a couple missed
      photos: [
        { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop', daysAgo: 13, caption: 'Starting point — day 1' },
        { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=800&fit=crop', daysAgo: 7,  caption: 'One week in, feeling good' },
        { url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&h=800&fit=crop', daysAgo: 0,  caption: 'Today' },
      ],
    },
    {
      email: 'maria.gomez@example.com',
      firstName: 'Maria',
      lastName: 'Gomez',
      dateOfBirth: new Date('1972-11-03'),
      gender: 'FEMALE' as const,
      healthIssue: 'Type 2 Diabetes',
      avatarUrl: 'https://i.pravatar.cc/300?img=47',
      phone: '+1-555-0198',
      address: '48 Elm Avenue, Riverside',
      medication: {
        name: 'Metformin',
        dosage: '500mg',
        form: 'TABLET' as const,
        quantityPerDose: 2,
        foodInstruction: 'WITH_FOOD' as const,
        instructions: 'Take twice daily with meals',
      },
      startWeight: 78.2,
      weightTrend: 0.1, // roughly stable
      feelings: ['OKAY', 'POOR', 'OKAY', 'GOOD', 'OKAY', 'GOOD', 'GOOD'] as const,
      doseAdherence: 0.6, // spottier adherence
      photos: [
        { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=800&fit=crop', daysAgo: 12, caption: 'Beginning of tracking' },
        { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=800&fit=crop', daysAgo: 6,  caption: 'Halfway check-in' },
        { url: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&h=800&fit=crop', daysAgo: 1,  caption: 'Latest update' },
      ],
    },
  ];

  for (const dp of dummyPatients) {
    const existing = await prisma.user.findUnique({
      where: { email: dp.email },
      include: { patientProfile: true },
    });
    if (existing) {
      // MedicationLog.userId, HealthLog.createdById and Photo.uploadedById are
      // all ON DELETE RESTRICT, so anything the patient authored must go before
      // the user row can be deleted.
      if (existing.patientProfile) {
        await prisma.medicationLog.deleteMany({
          where: { assignment: { patientId: existing.patientProfile.id } },
        });
      }
      await prisma.healthLog.deleteMany({ where: { createdById: existing.id } });
      await prisma.photo.deleteMany({ where: { uploadedById: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const user = await prisma.user.create({
      data: {
        email: dp.email,
        passwordHash,
        role: 'PATIENT',
        firstName: dp.firstName,
        lastName: dp.lastName,
      },
    });

    const profile = await prisma.patientProfile.create({
      data: {
        userId: user.id,
        dateOfBirth: dp.dateOfBirth,
        gender: dp.gender,
        healthIssue: dp.healthIssue,
        avatarUrl: dp.avatarUrl,
        phone: dp.phone,
        address: dp.address,
      },
    });

    const medication = await prisma.medication.create({
      data: {
        name: dp.medication.name,
        dosage: dp.medication.dosage,
        form: dp.medication.form,
        quantityPerDose: dp.medication.quantityPerDose,
        foodInstruction: dp.medication.foodInstruction,
        instructions: dp.medication.instructions,
      },
    });

    const assignment = await prisma.medicationAssignment.create({
      data: {
        patientId: profile.id,
        medicationId: medication.id,
        frequency: 'DAILY',
        timesOfDay: ['08:00'],
        startDate: daysAgo(13),
        active: true,
      },
    });

    // 14 days of health logs, alternating who logs them (patient vs staff)
    for (let i = 13; i >= 0; i--) {
      const dayIndex = 13 - i;
      const weight = Math.round((dp.startWeight + dp.weightTrend * dayIndex) * 10) / 10;
      const feeling = dp.feelings[dayIndex % dp.feelings.length];
      const loggedByStaff = dayIndex % 5 === 0 && staff;

      await prisma.healthLog.create({
        data: {
          patientId: profile.id,
          date: daysAgo(i),
          weight,
          feeling,
          notes: dayIndex % 4 === 0 ? 'Feeling steady, no new symptoms.' : undefined,
          createdById: loggedByStaff ? staff!.id : user.id,
          createdAt: daysAgo(i),
        },
      });

      // one dose log per day since assignment start
      const status = Math.random() < dp.doseAdherence ? 'TAKEN' : Math.random() < 0.5 ? 'MISSED' : 'SKIPPED';
      await prisma.medicationLog.create({
        data: {
          assignmentId: assignment.id,
          userId: user.id,
          status,
          takenAt: daysAgo(i),
        },
      });
    }

    for (const photo of dp.photos) {
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

    console.log(`Seeded patient ${dp.firstName} ${dp.lastName} (${dp.email}) — id ${profile.id}, ${dp.photos.length} photos`);
  }

  console.log('Seed complete. Dummy patient login password: Password123!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
