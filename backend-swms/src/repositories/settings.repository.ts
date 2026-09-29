import { prisma } from "@/lib/prisma";

const SETTINGS_ID = 1;

export const settingsRepository = {
  // The singleton row may not exist yet on a fresh database — upsert with an
  // empty create payload (all columns have schema defaults) is the safe way
  // to "get, creating the default row on first access" without ever risking
  // a second row.
  get() {
    return prisma.systemSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    });
  },

  update(data: {
    barangayName: string;
    municipality: string;
    contactNumber: string;
    monthlyCollectionFee: number;
    collectionDays: string;
    collectionTime: string;
  }) {
    return prisma.systemSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    });
  },
};
