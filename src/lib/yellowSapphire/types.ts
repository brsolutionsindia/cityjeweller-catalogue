export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type PublicListingStatus =
  | "AVAILABLE"
  | "HOLD"
  | "SOLD"
  | "HIDDEN";

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
  ratePerCaratInr: number;
  remarks?: string;

  media: {
    images: MediaItem[];
    videos: MediaItem[];
    thumbUrl?: string;
  };

  status: SubmissionStatus; // ✅ FIX
  createdAt?: any;
  updatedAt?: any;
};

export type YellowSapphireListing = {
  skuId: string;

  shapeCut: string;
  clarity: string;
  color: string;

  treatmentStatus: string;
  luster: string;
  origin: string;
  certified: string;

  weightCarat: number;
  measurementMm: string;
  ratePerCaratInr: number;
  remarks?: string;

  media: {
    images: MediaItem[];
    videos: MediaItem[];
    thumbUrl?: string;
  };

  status: PublicListingStatus; // ✅ FIX
  createdAt?: any;
  updatedAt?: any;
};

