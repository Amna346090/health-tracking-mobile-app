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
    {
      email: 'robert.chen@example.com',
      firstName: 'Robert',
      lastName: 'Chen',
      dateOfBirth: new Date('1990-02-21'),
      gender: 'MALE' as const,
      healthIssue: 'Asthma',
      avatarUrl: 'https://i.pravatar.cc/300?img=5',
      phone: '+1-555-0212',
      address: '77 Cedar Lane, Fairview',
      medication: {
        name: 'Albuterol',
        dosage: '90mcg',
        form: 'OTHER' as const,
        quantityPerDose: 2,
        foodInstruction: 'EITHER' as const,
        instructions: 'Two inhalations as needed for wheezing',
      },
      startWeight: 81.0,
      weightTrend: 0,
      feelings: ['GOOD', 'GREAT', 'GOOD', 'GOOD', 'OKAY', 'GREAT', 'GOOD'] as const,
      doseAdherence: 0.7,
      photos: [
        { url: 'https://picsum.photos/seed/robert-chen-1/600/800', daysAgo: 11, caption: 'Starting point — day 1' },
        { url: 'https://picsum.photos/seed/robert-chen-2/600/800', daysAgo: 5,  caption: 'Feeling steadier this week' },
        { url: 'https://picsum.photos/seed/robert-chen-3/600/800', daysAgo: 0,  caption: 'Today' },
      ],
    },
    {
      email: 'linda.torres@example.com',
      firstName: 'Linda',
      lastName: 'Torres',
      dateOfBirth: new Date('1965-07-09'),
      gender: 'FEMALE' as const,
      healthIssue: 'High Cholesterol',
      avatarUrl: 'https://i.pravatar.cc/300?img=25',
      phone: '+1-555-0233',
      address: '14 Magnolia Court, Rosewood',
      medication: {
        name: 'Atorvastatin',
        dosage: '20mg',
        form: 'TABLET' as const,
        quantityPerDose: 1,
        foodInstruction: 'WITHOUT_FOOD' as const,
        instructions: 'Take once daily in the evening',
      },
      startWeight: 70.4,
      weightTrend: -0.1,
      feelings: ['OKAY', 'GOOD', 'GOOD', 'OKAY', 'GOOD', 'GOOD', 'GREAT'] as const,
      doseAdherence: 0.9,
      photos: [
        { url: 'https://picsum.photos/seed/linda-torres-1/600/800', daysAgo: 10, caption: 'Beginning of tracking' },
        { url: 'https://picsum.photos/seed/linda-torres-2/600/800', daysAgo: 4,  caption: 'Halfway check-in' },
        { url: 'https://picsum.photos/seed/linda-torres-3/600/800', daysAgo: 0,  caption: 'Latest update' },
      ],
    },
    {
      email: 'james.whitfield@example.com',
      firstName: 'James',
      lastName: 'Whitfield',
      dateOfBirth: new Date('1958-12-30'),
      gender: 'MALE' as const,
      healthIssue: 'Chronic Back Pain',
      avatarUrl: 'https://i.pravatar.cc/300?img=33',
      phone: '+1-555-0267',
      address: '9 Willow Bend, Ashford',
      medication: {
        name: 'Gabapentin',
        dosage: '300mg',
        form: 'CAPSULE' as const,
        quantityPerDose: 1,
        foodInstruction: 'WITH_FOOD' as const,
        instructions: 'Take three times daily with meals',
      },
      startWeight: 95.6,
      weightTrend: 0.2,
      feelings: ['POOR', 'OKAY', 'POOR', 'OKAY', 'OKAY', 'GOOD', 'OKAY'] as const,
      doseAdherence: 0.55,
      photos: [
        { url: 'https://picsum.photos/seed/james-whitfield-1/600/800', daysAgo: 13, caption: 'Starting point — day 1' },
        { url: 'https://picsum.photos/seed/james-whitfield-2/600/800', daysAgo: 6,  caption: 'One week in' },
        { url: 'https://picsum.photos/seed/james-whitfield-3/600/800', daysAgo: 0,  caption: 'Today' },
      ],
    },
    {
      email: 'aisha.malik@example.com',
      firstName: 'Aisha',
      lastName: 'Malik',
      dateOfBirth: new Date('1994-09-17'),
      gender: 'FEMALE' as const,
      healthIssue: 'Anxiety Disorder',
      avatarUrl: 'https://i.pravatar.cc/300?img=44',
      phone: '+1-555-0284',
      address: '302 Hillcrest Drive, Millbrook',
      medication: {
        name: 'Sertraline',
        dosage: '50mg',
        form: 'TABLET' as const,
        quantityPerDose: 1,
        foodInstruction: 'EITHER' as const,
        instructions: 'Take once daily in the morning',
      },
      startWeight: 63.8,
      weightTrend: 0.05,
      feelings: ['OKAY', 'GOOD', 'GREAT', 'GOOD', 'GOOD', 'GREAT', 'GREAT'] as const,
      doseAdherence: 0.95,
      photos: [
        { url: 'https://picsum.photos/seed/aisha-malik-1/600/800', daysAgo: 9, caption: 'Beginning of tracking' },
        { url: 'https://picsum.photos/seed/aisha-malik-2/600/800', daysAgo: 4, caption: 'Feeling more like myself' },
        { url: 'https://picsum.photos/seed/aisha-malik-3/600/800', daysAgo: 0, caption: 'Today' },
      ],
    },
    {
      email: 'david.kim@example.com',
      firstName: 'David',
      lastName: 'Kim',
      dateOfBirth: new Date('1953-05-04'),
      gender: 'MALE' as const,
      healthIssue: 'COPD',
      avatarUrl: 'https://i.pravatar.cc/300?img=51',
      phone: '+1-555-0301',
      address: '18 Fernwood Street, Brookhaven',
      medication: {
        name: 'Tiotropium',
        dosage: '18mcg',
        form: 'OTHER' as const,
        quantityPerDose: 1,
        foodInstruction: 'EITHER' as const,
        instructions: 'One inhalation daily via HandiHaler',
      },
      startWeight: 74.1,
      weightTrend: -0.15,
      feelings: ['POOR', 'OKAY', 'OKAY', 'POOR', 'OKAY', 'OKAY', 'GOOD'] as const,
      doseAdherence: 0.65,
      photos: [
        { url: 'https://picsum.photos/seed/david-kim-1/600/800', daysAgo: 12, caption: 'Starting point — day 1' },
        { url: 'https://picsum.photos/seed/david-kim-2/600/800', daysAgo: 6,  caption: 'Halfway check-in' },
        { url: 'https://picsum.photos/seed/david-kim-3/600/800', daysAgo: 0,  caption: 'Today' },
      ],
    },
    {
      email: 'patricia.nguyen@example.com',
      firstName: 'Patricia',
      lastName: 'Nguyen',
      dateOfBirth: new Date('1948-03-26'),
      gender: 'FEMALE' as const,
      healthIssue: 'Osteoporosis',
      avatarUrl: 'https://i.pravatar.cc/300?img=60',
      phone: '+1-555-0319',
      address: '5 Orchard Path, Glenview',
      medication: {
        name: 'Alendronate',
        dosage: '70mg',
        form: 'TABLET' as const,
        quantityPerDose: 1,
        foodInstruction: 'WITHOUT_FOOD' as const,
        instructions: 'Take once weekly on an empty stomach, stay upright 30 minutes after',
      },
      startWeight: 58.9,
      weightTrend: -0.05,
      feelings: ['GOOD', 'GOOD', 'OKAY', 'GOOD', 'GREAT', 'GOOD', 'GOOD'] as const,
      doseAdherence: 0.8,
      photos: [
        { url: 'https://picsum.photos/seed/patricia-nguyen-1/600/800', daysAgo: 11, caption: 'Beginning of tracking' },
        { url: 'https://picsum.photos/seed/patricia-nguyen-2/600/800', daysAgo: 5,  caption: 'Halfway check-in' },
        { url: 'https://picsum.photos/seed/patricia-nguyen-3/600/800', daysAgo: 0,  caption: 'Latest update' },
      ],
    },
    {
      email: 'michael.brown@example.com',
      firstName: 'Michael',
      lastName: 'Brown',
      dateOfBirth: new Date('1980-10-08'),
      gender: 'MALE' as const,
      healthIssue: 'Obesity / Weight Management',
      avatarUrl: 'https://i.pravatar.cc/300?img=68',
      phone: '+1-555-0345',
      address: '210 Sunset Boulevard, Lakeside',
      medication: {
        name: 'Semaglutide',
        dosage: '0.5mg',
        form: 'INJECTION' as const,
        quantityPerDose: 1,
        foodInstruction: 'EITHER' as const,
        instructions: 'Inject subcutaneously once weekly',
      },
      startWeight: 118.3,
      weightTrend: -0.6,
      feelings: ['OKAY', 'GOOD', 'GOOD', 'GREAT', 'GOOD', 'GREAT', 'GREAT'] as const,
      doseAdherence: 0.9,
      photos: [
        { url: 'https://picsum.photos/seed/michael-brown-1/600/800', daysAgo: 13, caption: 'Starting point — day 1' },
        { url: 'https://picsum.photos/seed/michael-brown-2/600/800', daysAgo: 7,  caption: 'One week in, feeling motivated' },
        { url: 'https://picsum.photos/seed/michael-brown-3/600/800', daysAgo: 0,  caption: 'Today — down and feeling great' },
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

  // ─── Extra catalog medications (not assigned to any patient) ─────────────
  const catalogMedications = [
    { name: 'Ibuprofen', dosage: '200mg', form: 'TABLET' as const, quantityPerDose: 1, foodInstruction: 'WITH_FOOD' as const, instructions: 'Take every 6-8 hours as needed for pain' },
    { name: 'Amoxicillin', dosage: '500mg', form: 'CAPSULE' as const, quantityPerDose: 1, foodInstruction: 'EITHER' as const, instructions: 'Take three times daily for 7 days' },
    { name: 'Omeprazole', dosage: '20mg', form: 'CAPSULE' as const, quantityPerDose: 1, foodInstruction: 'WITHOUT_FOOD' as const, instructions: 'Take once daily before breakfast' },
    { name: 'Levothyroxine', dosage: '75mcg', form: 'TABLET' as const, quantityPerDose: 1, foodInstruction: 'WITHOUT_FOOD' as const, instructions: 'Take on an empty stomach, 30 minutes before eating' },
    { name: 'Amlodipine', dosage: '5mg', form: 'TABLET' as const, quantityPerDose: 1, foodInstruction: 'EITHER' as const, instructions: 'Take once daily' },
    { name: 'Losartan', dosage: '50mg', form: 'TABLET' as const, quantityPerDose: 1, foodInstruction: 'EITHER' as const, instructions: 'Take once daily' },
    { name: 'Simvastatin', dosage: '40mg', form: 'TABLET' as const, quantityPerDose: 1, foodInstruction: 'WITHOUT_FOOD' as const, instructions: 'Take once daily in the evening' },
    { name: 'Prednisone', dosage: '10mg', form: 'TABLET' as const, quantityPerDose: 1, foodInstruction: 'WITH_FOOD' as const, instructions: 'Take once daily with breakfast, taper as directed' },
    { name: 'Warfarin', dosage: '5mg', form: 'TABLET' as const, quantityPerDose: 1, foodInstruction: 'EITHER' as const, instructions: 'Take once daily at the same time, monitor INR regularly' },
    { name: 'Insulin Glargine', dosage: '100 units/mL', form: 'INJECTION' as const, quantityPerDose: 1, foodInstruction: 'EITHER' as const, instructions: 'Inject subcutaneously once daily at bedtime' },
  ];

  for (const med of catalogMedications) {
    const existing = await prisma.medication.findFirst({ where: { name: med.name, dosage: med.dosage } });
    if (!existing) {
      await prisma.medication.create({ data: med });
      console.log(`Added catalog medication ${med.name} (${med.dosage})`);
    }
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
