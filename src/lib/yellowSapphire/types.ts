export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PublicListingStatus = "AVAILABLE" | "HOLD" | "SOLD" | "HIDDEN";

export type MediaItem = {
  url: string;
  type: "image" | "video";
  storagePath?: string;
  fileName?: string;
  contentType?: string;
  createdAt?: number;
};

export type YellowSapphireSubmission = {
  skuId: string;
  gstNumber: string;
  supplierUid: string;

  stoneLocalCode?: string;

  shapeCut: string;
  clarity: string;
  color: string;

  treatmentStatus: string;
  luster: string;
  origin: string;
  certified: string;

  weightCarat: number;
  measurementMm: string;
  ratePerCaratInr: number; // supplier submitted base rate
  remarks?: string;

  media: {
    images: MediaItem[];
    videos: MediaItem[];
    thumbUrl?: string;
  };

  status: SubmissionStatus;

  // ✅ admin fields (NEW)
  adminRemarks?: string;        // shown to supplier when REJECTED
  adminMarginPct?: number;      // default 20
  approvedAt?: any;
  rejectedAt?: any;
  updatedAt?: any;
  createdAt?: any;
};

export type YellowSapphireListing = {
  skuId: string;

  stoneLocalCode?: string;

  shapeCut: string;
  clarity: string;
  color: string;

  treatmentStatus: string;
  luster: string;
  origin: string;
  certified: string;

  weightCarat: number;
  measurementMm: string;

  // ✅ pricing
  baseRatePerCaratInr: number;
  marginPct: number;
  publicRatePerCaratInr: number;

  remarks?: string;

  media: {
    images: MediaItem[];
    videos: MediaItem[];
    thumbUrl?: string;
  };

  status: PublicListingStatus; // public availability state
  approvedBy?: string;         // admin uid/email
  approvedAt?: any;
  updatedAt?: any;
  createdAt?: any;
};
