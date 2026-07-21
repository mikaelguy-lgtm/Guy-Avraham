import { db } from '../db';
import {
  clients,
  borrowers,
  employmentRecords,
  properties,
  loanRequests,
  documents,
  lenderSubmissions,
  lenderResponses,
  loanOffers,
  lenders
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { decryptField } from './crypto';

export function buildAnonymousSubmissionSnapshot(mappedClient: any): string {
  const formatCurrency = (val: string | number) => {
    const num = Number(val);
    if (isNaN(num)) return "₪0";
    return `₪${num.toLocaleString('he-IL')}`;
  };

  return `==================================================
       פרופיל אשראי אנונימי - SynCash
==================================================

פרטי העסקה והמימון המבוקש:
--------------------------------------------------
* סוג עסקה: ${mappedClient.dealType === 'PURCHASE' ? 'רכישת נכס' : mappedClient.dealType === 'REFINANCE' ? 'מיחזור משכנתא' : 'כל מטרה / אחר'}
* סוג נכס: ${mappedClient.propertyType === 'APARTMENT' ? 'דירה' : mappedClient.propertyType === 'HOUSE' ? 'בית פרטי' : 'מגרש/מסחרי'}
* שווי נכס מוערך: ${formatCurrency(mappedClient.propertyValue)}
* סכום מימון מבוקש: ${formatCurrency(mappedClient.requestedAmount)}
* שיעור מימון מבוקש (LTV): ${mappedClient.financingPercentage}%

נתונים פיננסיים ותעסוקתיים:
--------------------------------------------------
* סוג תעסוקה: ${mappedClient.employmentType === 'SALARIED' ? 'שכיר' : 'עצמאי'}
* הכנסה חודשית נטו: ${formatCurrency(mappedClient.income)}
* ותק מקצועי: ${mappedClient.seniority} שנים
* סטטוס משפחתי: ${mappedClient.maritalStatus === 'MARRIED' ? 'נשוי/אה' : 'רווק/ה / אחר'}
* מספר נפשות / ילדים: ${mappedClient.childrenCount}

הוצאות והתחייבויות חודשיות:
--------------------------------------------------
* הוצאות שוטפות: ${formatCurrency(mappedClient.expenses)}
* החזר משכנתא קיים: ${formatCurrency(mappedClient.expensesMortgage)}
* יתרת משכנתא קיימת: ${formatCurrency(mappedClient.expensesMortgageBalance)}

הערות חתם ודגשים מיוחדים:
--------------------------------------------------
${mappedClient.notes || 'אין הערות מיוחדות.'}

==================================================
פנייה אנונימית זו נערכה ואומתה על ידי יועץ פיננסי מורשה בפלטפורמת SynCash.
==================================================`;
}

export async function mapDbClientToFrontend(clientId: number, userRole: string): Promise<any> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return null;

  const dbBorrowers = await db.select().from(borrowers).where(eq(borrowers.clientId, clientId));
  
  let primaryBorrowerId = dbBorrowers.find(b => b.borrowerType === 'PRIMARY')?.id;
  let employment: any = null;
  if (primaryBorrowerId) {
    [employment] = await db.select().from(employmentRecords).where(eq(employmentRecords.borrowerId, primaryBorrowerId)).limit(1);
  }

  const [property] = await db.select().from(properties).where(eq(properties.clientId, clientId)).limit(1);
  const [loanRequest] = await db.select().from(loanRequests).where(eq(loanRequests.clientId, clientId)).limit(1);
  const dbDocs = await db.select().from(documents).where(eq(documents.clientId, clientId));
  const dbSubmissions = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.clientId, clientId));
  
  const lendersState: Record<string, any> = {};
  const allLenders = await db.select().from(lenders);

  // Initialize both by ID and Name to cover all frontend lookups securely
  for (const lender of allLenders) {
    lendersState[lender.id] = { status: 'not_sent' };
    lendersState[lender.name] = { status: 'not_sent' };
  }

  for (const sub of dbSubmissions) {
    const lender = allLenders.find(l => l.id === sub.lenderId);
    if (!lender) continue;
    
    const [response] = await db.select().from(lenderResponses)
      .where(eq(lenderResponses.submissionId, sub.id))
      .orderBy(lenderResponses.createdAt)
      .limit(1);
      
    const [offer] = await db.select().from(loanOffers)
      .where(eq(loanOffers.submissionId, sub.id))
      .orderBy(loanOffers.createdAt)
      .limit(1);

    const subState = {
      status: sub.status === 'OFFER_RECEIVED' ? 'offer_received' : sub.status.toLowerCase(),
      pitch: sub.anonymousSnapshot || '',
      reply: response ? response.message : '',
      offer: offer ? {
        amount: String(Math.round(Number(offer.amount))),
        rate: String(offer.interestRate),
        years: String(Math.round(offer.termMonths / 12))
      } : undefined
    };

    lendersState[sub.lenderId] = subState;
    lendersState[lender.name] = subState;
  }

  const isAuthorizedToDecrypt = ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'].includes(userRole);
  
  let name = 'לקוח אנונימי';
  let idNumber = '******';
  let phone = '***';
  let email = '***';
  let address = '***';
  let notes = '***';
  let workplace = 'לא ידוע';

  if (isAuthorizedToDecrypt) {
    name = `${client.firstName} ${client.lastName}`;
    idNumber = decryptField(client.identityNumberEncrypted);
    phone = decryptField(client.phoneEncrypted);
    email = decryptField(client.emailEncrypted);
    address = decryptField(client.addressEncrypted);
    notes = decryptField(client.notesEncrypted);
    
    if (employment) {
      workplace = decryptField(employment.employerNameEncrypted) || employment.jobTitle || 'לא ידוע';
    }
  } else {
    name = `${client.firstName.substring(0, 1)}***`;
    idNumber = `******${client.identityNumberLast4 || ''}`;
  }

  const mappedClient = {
    id: String(client.id),
    advisorId: String(client.advisorId),
    name,
    idNumber,
    email,
    phone,
    address,
    employmentType: employment ? employment.employmentType : 'SALARIED',
    maritalStatus: client.maritalStatus || 'SINGLE',
    childrenCount: String(client.numberOfChildren || 0),
    childrenAges: '',
    seniority: employment ? String(Math.round((Date.now() - new Date(employment.startDate).getTime()) / (365 * 24 * 3600 * 1000))) : '1',
    income: employment ? String(Math.round(Number(employment.monthlyNetIncome))) : '0',
    workplace,
    additionalIncomeType: '',
    additionalIncomeAmount: '0',
    expenses: property ? String(Math.round(Number(property.existingMortgageBalance ? 2000 : 0))) : '0',
    expensesLoans: '0',
    expensesMortgage: property ? String(Math.round(Number(property.existingMortgageBalance ? 3500 : 0))) : '0',
    expensesMortgageBalance: property ? String(Math.round(Number(property.existingMortgageBalance || 0))) : '0',
    dealType: loanRequest ? loanRequest.purpose : 'PURCHASE',
    propertyType: property ? property.propertyType : 'APARTMENT',
    propertyCity: property ? property.city : '',
    propertyStreet: '',
    propertyValue: property ? String(Math.round(Number(property.estimatedValue))) : '0',
    requestedAmount: loanRequest ? String(Math.round(Number(loanRequest.requestedAmount))) : '0',
    financingPercentage: loanRequest ? String(Math.round(Number(loanRequest.loanToValue || 50))) : '50',
    notes,
    createdAt: client.createdAt.toISOString(),
    status: client.status.toLowerCase(),
    documents: dbDocs.map(d => ({
      id: String(d.id),
      name: d.documentType,
      status: d.status === 'VERIFIED' ? 'uploaded' : (d.status === 'UPLOADED' ? 'uploaded' : 'pending'),
      date: d.uploadedAt ? d.uploadedAt.toISOString().split('T')[0] : ''
    })),
    lendersState
  };

  return mappedClient;
}
