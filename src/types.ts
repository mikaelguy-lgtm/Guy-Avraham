export interface ClientDocument {
  id: string;
  name: string;
  status: "pending" | "uploaded";
  date: string;
}

export interface LenderOffer {
  amount: string;
  rate: string;
  years: string;
}

export interface LenderState {
  status: "not_sent" | "sent" | "offer_received" | "rejected" | "sent_anonymous" | "interested" | "not_interested" | "contact_revealed";
  pitch?: string;
  reply?: string;
  offer?: LenderOffer;
}

export interface Client {
  id: string;
  name: string;
  idNumber: string;
  email: string;
  phone: string;
  address: string;
  employmentType: string;
  maritalStatus?: string;
  childrenCount?: string;
  childrenAges?: string;
  seniority: string;
  income: string;
  workplace?: string;
  additionalIncomeType?: string;
  additionalIncomeAmount?: string;
  expenses: string;
  expensesLoans?: string;
  expensesMortgage?: string;
  expensesMortgageBalance?: string;
  dealType: string;
  propertyType?: string;
  propertyCity?: string;
  propertyStreet?: string;
  propertyValue: string;
  requestedAmount: string;
  financingPercentage: string;
  notes: string;
  createdAt: string;
  status: "draft" | "active" | "sent" | "closed";
  documents: ClientDocument[];
  advisorId?: string;
  lendersState: {
    [lenderName: string]: LenderState;
  };
}

export interface Lender {
  id: string;
  name: string;
  email: string;
  description: string;
  specialty: string;
  status: "active" | "suspended";
}

export interface AdvisorProfile {
  name: string;
  role: string;
  email: string;
  phone: string;
  company: string;
  licenseNumber: string;
}
