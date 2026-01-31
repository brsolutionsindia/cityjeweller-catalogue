export type MediaItem = {
  url: string;
  path: string; // Firebase Storage path, used for delete
  createdAt: number;
  type: "image" | "video";
};

export type YellowSapphireListing = {
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

  status: "AVAILABLE" | "HOLD" | "SOLD" | "HIDDEN";
  createdAt?: any;
  updatedAt?: any;
};
