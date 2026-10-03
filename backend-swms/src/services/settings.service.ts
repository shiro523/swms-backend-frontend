import { settingsRepository } from "@/repositories/settings.repository";
import { mapSettings } from "@/utils/mappers";

export const settingsService = {
  async get() {
    const row = await settingsRepository.get();
    return mapSettings(row);
  },

  async update(input: {
    barangayName: string;
    municipality: string;
    contactNumber: string;
    monthlyCollectionFee: number;
    collectionDays: string;
    collectionTime: string;
  }) {
    const row = await settingsRepository.update(input);
    return mapSettings(row);
  },
};
