import { motion } from "framer-motion";
import { mockPerImageMetrics, mockFailureGroups } from "@/data/mockData";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const tooltipStyle = { background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, color: "hsl(0 0% 92%)" };

const failureColors: Record<string, string> = {
  "Severe Under-Segmentation": "hsl(0, 72%, 51%)",
  "Class Confusion": "hsl(38, 92%, 50%)",
  "Boundary Bleed": "hsl(270, 60%, 60%)",
  "Label Noise Suspected": "hsl(14, 78%, 57%)",
  "Minor Issues": "hsl(142, 71%, 45%)",
};

export default function FailureCasesPage() {
  const [filter, setFilter] = useState("All");
  const filtered = filter === "All" ? mockPerImageMetrics : mockPerImageMetrics.filter(m => m.failure_type === filter);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">Failure Cases</h2>
        <p className="text-muted-foreground text-sm mt-1">Worst-performing images grouped by failure type</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="font-heading font-semibold mb-4">Failure Group Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mockFailureGroups} layout="vertical">
              <XAxis type="number" tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="failure_type" type="category" tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} width={180} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {mockFailureGroups.map((g, i) => (
                  <Cell key={i} fill={failureColors[g.failure_type] || "hsl(0 0% 40%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-heading font-semibold mb-4">Avg IoU by Failure Type</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mockFailureGroups} layout="vertical">
              <XAxis type="number" domain={[0, 1]} tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="failure_type" type="category" tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} width={180} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avg_iou" radius={[0, 6, 6, 0]}>
                {mockFailureGroups.map((g, i) => (
                  <Cell key={i} fill={g.avg_iou < 0.3 ? "hsl(0, 72%, 51%)" : g.avg_iou < 0.5 ? "hsl(38, 92%, 50%)" : "hsl(142, 71%, 45%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold">Image-Level Results</h3>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[220px] bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Failure Types</SelectItem>
              {mockFailureGroups.map(g => (
                <SelectItem key={g.failure_type} value={g.failure_type}>{g.failure_type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium">Image</th>
                <th className="text-left py-3 px-4 font-medium">Mean IoU</th>
                <th className="text-left py-3 px-4 font-medium">Mean Dice</th>
                <th className="text-left py-3 px-4 font-medium">Failure Type</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs">{row.image_name}</td>
                  <td className="py-3 px-4">
                    <span className={row.mean_iou < 0.3 ? "text-destructive font-semibold" : row.mean_iou < 0.5 ? "text-warning" : "text-success"}>
                      {row.mean_iou.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-3 px-4">{row.mean_dice.toFixed(3)}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-xs" style={{ borderColor: failureColors[row.failure_type] }}>
                      {row.failure_type}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
