"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonthlyCollectionStat } from "@/lib/api";
import type { Purok } from "@/lib/types";

const PINE = "#1f5f4f";
const CLAY = "#b8622e";
const GOLD = "#b8862c";
const AZURE = "#2c6a86";

export function ComplianceTrendChart({ data }: { data: MonthlyCollectionStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ left: -20, top: 10 }}>
        <defs>
          <linearGradient id="compliantFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PINE} stopOpacity={0.35} />
            <stop offset="100%" stopColor={PINE} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#d7ddcd" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#16241c99" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#16241c99" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: "1px solid #d7ddcd", fontSize: 12 }}
        />
        <Area type="monotone" dataKey="compliant" name="Compliant" stroke={PINE} fill="url(#compliantFill)" strokeWidth={2} />
        <Area type="monotone" dataKey="violations" name="Violations" stroke={CLAY} fill="transparent" strokeWidth={2} />
        <Area type="monotone" dataKey="missed" name="Missed" stroke={GOLD} fill="transparent" strokeWidth={2} strokeDasharray="4 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PurokComplianceBar({ puroks }: { puroks: Purok[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={puroks} margin={{ left: -20, top: 10 }}>
        <CartesianGrid vertical={false} stroke="#d7ddcd" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10.5, fill: "#16241c99" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => v.split(" - ")[1] ?? v}
        />
        <YAxis tick={{ fontSize: 11, fill: "#16241c99" }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d7ddcd", fontSize: 12 }} />
        <Bar dataKey="complianceRate" name="Compliance rate" radius={[6, 6, 0, 0]}>
          {puroks.map((p) => (
            <Cell key={p.id} fill={p.complianceRate >= 90 ? PINE : p.complianceRate >= 80 ? AZURE : GOLD} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaidUnpaidPie({ paid, unpaid, pending }: { paid: number; unpaid: number; pending: number }) {
  const data = [
    { name: "Paid", value: paid, color: PINE },
    { name: "Pending", value: pending, color: GOLD },
    { name: "Unpaid", value: unpaid, color: CLAY },
  ];
  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} stroke="none" />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #d7ddcd", fontSize: 12 }} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ fontSize: 12, color: "#16241c99" }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
