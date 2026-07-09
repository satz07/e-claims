export enum OpportunitySector {
  EDUCATION = 'Education',
  HEALTH = 'Health',
  ENVIRONMENT = 'Environment',
  SOCIAL = 'Social',
}

export enum PriorityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum OpportunityApprovalStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED', // Admin approved — opportunity is now live/active
  ACTIVE = 'ACTIVE', // Actively accepting donations
  REJECTED = 'REJECTED',
  ON_HOLD = 'ON_HOLD',
  RETURNED = 'RETURNED',
  COMPLETED = 'COMPLETED', // All milestones disbursed — admin marks complete
  EXPIRED = 'EXPIRED', // End date passed without completion
}

export enum CampaignRequestStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
