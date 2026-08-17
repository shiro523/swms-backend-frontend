import { statsRepository } from "@/repositories/stats.repository";

export const statsService = {
  async monthlyCollection() {
    const rows = await statsRepository.monthlyCollection();
    return rows.map((r) => ({
      month: r.month,
      compliant: Number(r.compliant),
      violations: Number(r.violations),
      missed: Number(r.missed),
    }));
  },

  async paymentCollection() {
    const rows = await statsRepository.paymentCollection();
    return rows.map((r) => ({
      month: r.month,
      collected: Number(r.collected),
      target: Number(r.target),
    }));
  },
};
