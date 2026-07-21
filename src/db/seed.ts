import { db } from './index';
import { adminAuth } from '../lib/firebase-admin';
import {
  users,
  advisorProfiles,
  lenders,
  lenderUsers,
  clients,
  borrowers,
  employmentRecords,
  incomeSources,
  properties,
  loanRequests
} from './schema';
import { eq } from 'drizzle-orm';

export async function runSeed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED IS FORBIDDEN IN PRODUCTION!');
  }
  
  console.log('Starting SynCash database seeding...');
  
  const devUsers = [
    {
      email: 'admin@syncash.co.il',
      password: 'admin123',
      firstName: 'מנהל',
      lastName: 'על',
      phone: '03-9998888',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    },
    {
      email: 'david.c@syncash.co.il',
      password: '123456',
      firstName: 'דוד',
      lastName: 'כהן',
      phone: '050-1234567',
      role: 'ADVISOR',
      status: 'ACTIVE',
      businessName: 'כהן פיננסיים ומשכנתאות',
      licenseNumber: 'MC-77402'
    },
    {
      email: 'michal.a@aharoni-finance.co.il',
      password: '123456',
      firstName: 'מיכל',
      lastName: 'אהרוני',
      phone: '052-7654321',
      role: 'ADVISOR',
      status: 'ACTIVE',
      businessName: 'אהרוני פתרונות מימון',
      licenseNumber: 'MC-99213'
    },
    {
      email: 'underwriter1@syncash.co.il',
      password: '123456',
      firstName: 'יוסי',
      lastName: 'לוי',
      phone: '054-1112222',
      role: 'LENDER_UNDERWRITER',
      status: 'ACTIVE',
      lenderName: 'BTB מימון'
    },
    {
      email: 'underwriter2@syncash.co.il',
      password: '123456',
      firstName: 'שרה',
      lastName: 'ישראלי',
      phone: '054-3334444',
      role: 'LENDER_UNDERWRITER',
      status: 'ACTIVE',
      lenderName: 'טריא Tarya'
    }
  ];
  
  // Seed lenders first
  const lendersData = [
    { name: 'BTB מימון', legalName: 'בי טי בי מימון בע"מ', companyNumber: '514029312', website: 'https://btb.co.il' },
    { name: 'טריא Tarya', legalName: 'טריא פינטק בע"מ', companyNumber: '515023912', website: 'https://tarya.co.il' },
    { name: 'פנינסולה Peninsula', legalName: 'פנינסולה בע"מ', companyNumber: '513928122', website: 'https://peninsula.co.il' }
  ];
  
  const dbLenders: any[] = [];
  for (const lender of lendersData) {
    const [existing] = await db.select().from(lenders).where(eq(lenders.name, lender.name)).limit(1);
    if (existing) {
      dbLenders.push(existing);
      console.log(`Lender ${lender.name} already exists.`);
    } else {
      const [inserted] = await db.insert(lenders).values(lender).returning();
      dbLenders.push(inserted);
      console.log(`Seeded lender: ${lender.name}`);
    }
  }
  
  for (const devUser of devUsers) {
    let firebaseUid = '';
    
    // 1. Get or create Firebase User
    try {
      const existingFbUser = await adminAuth.getUserByEmail(devUser.email);
      firebaseUid = existingFbUser.uid;
      console.log(`Firebase user already exists for ${devUser.email} (UID: ${firebaseUid})`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        const newFbUser = await adminAuth.createUser({
          email: devUser.email,
          password: devUser.password,
          displayName: `${devUser.firstName} ${devUser.lastName}`,
          emailVerified: true
        });
        firebaseUid = newFbUser.uid;
        console.log(`Created Firebase user for ${devUser.email} (UID: ${firebaseUid})`);
      } else {
        console.error(`Failed to handle Firebase user ${devUser.email}:`, error);
        continue;
      }
    }
    
    // 2. Sync to PostgreSQL
    let [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
    if (!dbUser) {
      [dbUser] = await db.insert(users).values({
        firebaseUid,
        email: devUser.email.toLowerCase(),
        firstName: devUser.firstName,
        lastName: devUser.lastName,
        phone: devUser.phone,
        role: devUser.role as any,
        status: devUser.status as any,
        emailVerified: true
      }).returning();
      console.log(`Synced user ${devUser.email} to PostgreSQL (ID: ${dbUser.id})`);
    } else {
      console.log(`User ${devUser.email} already exists in PostgreSQL (ID: ${dbUser.id})`);
    }
    
    // 3. Create role-specific profiles
    if (devUser.role === 'ADVISOR') {
      const [existingProfile] = await db.select().from(advisorProfiles).where(eq(advisorProfiles.userId, dbUser.id)).limit(1);
      if (!existingProfile) {
        await db.insert(advisorProfiles).values({
          userId: dbUser.id,
          businessName: devUser.businessName,
          licenseNumber: devUser.licenseNumber,
          businessEmail: devUser.email,
          businessPhone: devUser.phone
        });
        console.log(`Created advisor profile for advisor ID: ${dbUser.id}`);
      }
    } else if (devUser.role === 'LENDER_UNDERWRITER' && devUser.lenderName) {
      const matchedLender = dbLenders.find(l => l.name === devUser.lenderName);
      if (matchedLender) {
        const [existingLenderUser] = await db.select().from(lenderUsers).where(eq(lenderUsers.userId, dbUser.id)).limit(1);
        if (!existingLenderUser) {
          await db.insert(lenderUsers).values({
            userId: dbUser.id,
            lenderId: matchedLender.id,
            jobTitle: 'חתם ראשי',
            isPrimaryContact: true
          });
          console.log(`Assigned underwriter ID: ${dbUser.id} to lender: ${matchedLender.name}`);
        }
      }
    }
  }
  
  // Seed clients for david.c
  const [davidUser] = await db.select().from(users).where(eq(users.email, 'david.c@syncash.co.il')).limit(1);
  if (davidUser) {
    const [existingClient] = await db.select().from(clients).where(eq(clients.advisorId, davidUser.id)).limit(1);
    if (!existingClient) {
      const [clientRecord] = await db.insert(clients).values({
        advisorId: davidUser.id,
        caseNumber: 'SC-2026-0001',
        status: 'ACTIVE',
        firstName: 'ישראל',
        lastName: 'ישראלי',
        identityNumberEncrypted: 'v1:f323:tag:encrypted_placeholder',
        identityNumberHash: 'df4e0e5a9143899f1b34e565985ea1451f4c7849c717fb00eb9c9b14c3cd1c01',
        identityNumberLast4: '4567',
        birthDate: '1985-05-12',
        phoneEncrypted: 'v1:a324:tag:phone_placeholder',
        emailEncrypted: 'v1:c423:tag:email_placeholder',
        maritalStatus: 'MARRIED',
        numberOfChildren: 3,
        city: 'תל אביב',
        addressEncrypted: 'v1:d123:tag:address_placeholder',
        notesEncrypted: 'v1:e123:tag:notes_placeholder'
      }).returning();
      
      console.log(`Seeded client Israel Israeli (ID: ${clientRecord.id})`);
      
      const [borrowerRecord] = await db.insert(borrowers).values({
        clientId: clientRecord.id,
        borrowerType: 'PRIMARY',
        firstName: 'ישראל',
        lastName: 'ישראלי',
        identityNumberEncrypted: 'v1:f323:tag:encrypted_placeholder',
        identityNumberHash: 'df4e0e5a9143899f1b34e565985ea1451f4c7849c717fb00eb9c9b14c3cd1c01',
        identityNumberLast4: '4567',
        birthDate: '1985-05-12',
        relationshipToPrimary: 'SELF'
      }).returning();
      
      await db.insert(employmentRecords).values({
        borrowerId: borrowerRecord.id,
        employmentType: 'SALARIED',
        employerNameEncrypted: 'v1:g123:tag:employer_placeholder',
        jobTitle: 'מנהל פיתוח',
        startDate: '2018-03-01',
        monthlyNetIncome: '18500.00',
        monthlyGrossIncome: '24000.00'
      });
      
      await db.insert(incomeSources).values({
        borrowerId: borrowerRecord.id,
        incomeType: 'SALARY',
        description: 'משכורת חודשית שוטפת',
        monthlyAmount: '18500.00',
        isFixed: true
      });
      
      await db.insert(properties).values({
        clientId: clientRecord.id,
        propertyType: 'APARTMENT',
        city: 'תל אביב',
        addressEncrypted: 'v1:h123:tag:address_placeholder',
        estimatedValue: '3000000.00',
        purchasePrice: '2900000.00',
        existingMortgageBalance: '1200000.00',
        ownershipPercentage: '100.00',
        registrationType: 'TABU'
      });
      
      await db.insert(loanRequests).values({
        clientId: clientRecord.id,
        purpose: 'REFINANCE',
        requestedAmount: '1500000.00',
        requestedTermMonths: 240,
        requestedMonthlyPayment: '8500.00',
        loanToValue: '50.00'
      });
      
      console.log('Seeded complete sample case data.');
    }
  }
  
  console.log('Database seeding successfully completed.');
}
