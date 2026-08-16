export const statuses = ["New", "Scheduled", "In Progress", "Waiting on Parts", "Needs Inspection", "Complete", "Billed", "Paid"] as const;
export const jobTypeOptions = ["Trim out", "Service", "Warranty", "Setup", "Skirting", "Repair"] as const;
export const priorities = ["Low", "Normal", "High", "Urgent"] as const;
export const sources = ["Dealer", "Factory", "Individual"] as const;
export const checklistLabels = [
  "Paperwork picked up", "Scope reviewed", "Materials checked", "Before photos taken",
  "Serial/VIN tag photo taken", "Work completed", "After photos taken",
  "Completion notes added", "Customer/source notified", "Invoice created",
] as const;

export type JobStatus = typeof statuses[number];
export type Priority = typeof priorities[number];
export type JobSource = typeof sources[number];
export type ChecklistItem = { id: string; label: string; complete: boolean };
export type Employee = { id: string; name: string; active: boolean };
export type BusinessSettings = {
  businessId: string;
  appDisplayName: string;
  headerName: string;
  brandShortName: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  defaultCalendar: string;
  defaultState: string;
  merchandiseLink: string;
  fieldSupportName: string;
  fieldSupportPhone: string;
  employeeHelpInstructions: string;
  employeeFieldNotice: string;
  managerReviewInstructions: string;
  customerTextTemplate: string;
  factoryCostInstructions: string;
  factoryCostDefaults: FactoryCostTracker;
  employeeCanRequestHelp: boolean;
  employeeCanStartJobs: boolean;
  employeeCanAddQuickNotes: boolean;
  employeeCanAddCompletionNotes: boolean;
  employeeCanUploadFiles: boolean;
  employeeCanRequestParts: boolean;
  employeeCanAddFactoryCosts: boolean;
  employeeCanSendReadyReview: boolean;
  employeeCanAddSignoffs: boolean;
  employeeCanViewPackets: boolean;
  showCompletedJobsInFieldApp: boolean;
  jobTypeOptions: string[];
  statusOptions: string[];
  priorityOptions: string[];
  checklistOptions: string[];
  employeeFieldNoteTemplates: string[];
  requireAfterPhotosToComplete: boolean;
  requireBeforePhotosForReview: boolean;
  requireSerialTagPhotoForReview: boolean;
  requireDamagePhotosForReview: boolean;
  requireAfterPhotosForReview: boolean;
  requireCompletionNotesForReview: boolean;
  requireWorkCompleteForReview: boolean;
  requirePartsClosedForReview: boolean;
  requireFactoryCostsForReview: boolean;
  requireReceiptBackupForReview: boolean;
};
export type MerchRequestStatus = "Requested" | "Approved" | "Ordered" | "Received";
export type MerchRequest = {
  id: string;
  businessId: string;
  item: string;
  size: string;
  color: string;
  quantity: string;
  requestedBy: string;
  notes: string;
  status: MerchRequestStatus;
  createdAt: string;
};
export type JobActivity = {
  id: string;
  type: "Note" | "Status" | "Customer" | "Source" | "Parts" | "Calendar" | "CompanyCam" | "Paperwork" | "Receipt" | "Invoice" | "Time" | "Signoff";
  message: string;
  createdAt: string;
  createdBy: string;
  audience?: "All" | "Admin" | "Manager" | "Employee";
  notify?: boolean;
  readBy?: string[];
  resolvedAt?: string;
  resolvedBy?: string;
  followUpDueDate?: string;
};
export type PaperworkItem = {
  id: string;
  label: string;
  status: "Needed" | "Collected" | "Submitted" | "Not needed";
  notes?: string;
};
export type ReceiptItem = {
  id: string;
  vendor: string;
  amount: string;
  category?: "Meal" | "Lodging" | "Parts / Materials" | "Misc" | "Materials" | "Parts" | "Fuel" | "Tools" | "Other";
  date: string;
  reimbursable: boolean;
  notes?: string;
  file?: WorkOrderFile;
};
export type PartItem = {
  id: string;
  name: string;
  quantity: string;
  status: "Needed" | "Ordered" | "Picked up" | "Installed" | "Not needed";
  requestedBy: string;
  requestedAt: string;
  notes?: string;
};
export type TimeEntry = {
  id: string;
  type: "Arrived" | "Work started" | "Paused" | "Departed" | "Mileage" | "Note";
  employeeName: string;
  createdAt: string;
  mileage?: string;
  origin?: string;
  notes?: string;
};
export type SignoffItem = {
  id: string;
  type: "Work Authorization" | "Completion Sign-off" | "Customer Approval" | "Inspection";
  signerName: string;
  signerRole: "Customer" | "Dealer" | "Factory" | "Manager" | "Other";
  signedAt: string;
  accepted: boolean;
  notes?: string;
  typedSignature: string;
};
export type CustomerSurvey = {
  completed: boolean;
  serviceRating?: "1" | "2" | "3" | "4" | "5";
  comments?: string;
  customerSatisfied?: boolean;
  wouldRecommend?: boolean;
  completedDate?: string;
};
export type FactoryCostTracker = {
  mileageRate: string;
  miles: string;
  driveTimeHours: string;
  hourlyRate: string;
  helperHours: string;
  helperRate: string;
  perDiemDays: string;
  perDiemRate: string;
  hotelTotal: string;
  materialsTotal: string;
  otherReceiptsTotal: string;
  notes?: string;
};
export type FileCategory = "Work Order" | "Paperwork" | "Receipt" | "Signed Document" | "Before" | "Progress" | "After" | "Damage" | "Serial / Tags" | "Parts" | "Other";
export type WorkOrderFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
  storagePath?: string;
  storageUrl?: string;
  category?: FileCategory;
  caption?: string;
  uploadedBy?: string;
  uploadedAt: string;
  extractedText?: string;
};

export interface Job {
  jobId: string;
  source: JobSource;
  dealerName: string;
  factoryWorkOrderNumber: string;
  serialUnitNumber?: string;
  returnVisitRequired?: boolean;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  homeSize: string;
  jobType: string;
  priority: Priority;
  status: JobStatus;
  assignedCrew: string;
  assignedEmployeeIds?: string[];
  fullCrew?: boolean;
  dueDate: string;
  scheduledTime?: string;
  scopeNotes: string;
  partsNeeded: string;
  paperworkPickedUp: boolean;
  paperworkPickedUpBy: string;
  paperworkPickupDate: string;
  beforePhotos: string[];
  damagePhotos: string[];
  serialTagPhotos: string[];
  afterPhotos: string[];
  completionNotes: string;
  invoiceStatus: string;
  invoiceDate?: string;
  invoiceAmount?: number;
  paidDate?: string;
  paymentDueDate?: string;
  checklist: ChecklistItem[];
  activityLog?: JobActivity[];
  paperworkItems?: PaperworkItem[];
  receipts?: ReceiptItem[];
  partsItems?: PartItem[];
  timeEntries?: TimeEntry[];
  signoffs?: SignoffItem[];
  customerSurvey?: CustomerSurvey;
  factoryCost?: FactoryCostTracker;
  workOrderFiles?: WorkOrderFile[];
  syncToCalendar?: boolean;
  syncToCompanyCam?: boolean;
  googleCalendarEventId?: string;
  googleCalendarEventUrl?: string;
  companyCamProjectId?: string;
  companyCamProjectUrl?: string;
  integrationsLastSyncedAt?: string;
}

export const aiWorkOrderImportFields = ["customerName", "phone", "address", "city", "jobType", "scopeNotes", "factoryWorkOrderNumber", "serialUnitNumber", "dueDate", "scheduledTime", "returnVisitRequired", "partsNeeded", "homeSize"] as const;
export type AIWorkOrderImport = Pick<Job, typeof aiWorkOrderImportFields[number]>;

export const makeChecklist = (completed = 0): ChecklistItem[] => checklistLabels.map((label, index) => ({
  id: `item-${index + 1}`, label, complete: index < completed,
}));

export function defaultFactoryCost(): FactoryCostTracker {
  return {
    mileageRate: "0.67",
    miles: "",
    driveTimeHours: "",
    hourlyRate: "",
    helperHours: "",
    helperRate: "",
    perDiemDays: "",
    perDiemRate: "",
    hotelTotal: "",
    materialsTotal: "",
    otherReceiptsTotal: "",
    notes: "",
  };
}

export const emptyJob: Job = {
  jobId: "", source: "Dealer", dealerName: "", factoryWorkOrderNumber: "", serialUnitNumber: "", returnVisitRequired: false, customerName: "",
  phone: "", address: "", city: "", homeSize: "Single-wide", jobType: "Setup",
  priority: "Normal", status: "New", assignedCrew: "Unassigned", assignedEmployeeIds: [], fullCrew: false, dueDate: "", scheduledTime: "", scopeNotes: "",
  partsNeeded: "", paperworkPickedUp: false, paperworkPickedUpBy: "", paperworkPickupDate: "",
  beforePhotos: [], damagePhotos: [], serialTagPhotos: [], afterPhotos: [], completionNotes: "",
  invoiceStatus: "Not started", checklist: makeChecklist(),
  activityLog: [], paperworkItems: [], receipts: [], partsItems: [], timeEntries: [], signoffs: [], workOrderFiles: [],
  factoryCost: defaultFactoryCost(),
  syncToCalendar: false,
  syncToCompanyCam: false,
};
