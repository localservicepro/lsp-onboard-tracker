import type { CallType } from "./types";

export interface NewClientInput {
  businessName: string;
  clientName: string;
  assignedTeamMember: string;
  callType: CallType;
  callDate?: string | undefined;
  contactDetails?: string | undefined;
  ghlLink?: string | undefined;
  notes?: string | undefined;
  isTestRecord?: boolean | undefined;
  testPurpose?: string | undefined;
  accountContext?: string | undefined;
}