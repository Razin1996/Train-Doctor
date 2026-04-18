import { motion } from "framer-motion";
import { mockTrainLog } from "@/data/mockData";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const tooltipStyle = { background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: 8, color: "hsl(0 0% 92%)" };

export default function PerformancePage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">Performance</h2>
        <p className="text-muted-foreground text-sm mt-1">Training curves and convergence analysis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {([
          { title: "Loss", keys: ["train_loss", "val_loss"], colors: ["hsl(14, 78%, 57%)", "hsl(38, 92%, 50%)"] },
          { title: "IoU", keys: ["train_iou", "val_iou"], colors: ["hsl(142, 71%, 45%)", "hsl(200, 70%, 50%)"] },
          { title: "Dice", keys: ["train_dice", "val_dice"], colors: ["hsl(270, 60%, 60%)", "hsl(320, 60%, 55%)"] },
        ] as const).map(({ title, keys, colors }) => (
          <div key={title} className="glass-card p-5">
            <h3 className="font-heading font-semibold mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={mockTrainLog}>
                <XAxis dataKey="epoch" tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: "hsl(0 0% 75%)" }} />
                <Line type="monotone" dataKey={keys[0]} stroke={colors[0]} strokeWidth={2} dot={false} name={`Train ${title}`} />
                <Line type="monotone" dataKey={keys[1]} stroke={colors[1]} strokeWidth={2} dot={false} name={`Val ${title}`} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <h3 className="font-heading font-semibold mb-2">Convergence Notes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-4 rounded-lg bg-secondary/50">
            <p className="text-sm font-medium text-foreground">Loss Gap</p>
            <p className="text-2xl font-heading font-bold text-primary mt-1">
              {(mockTrainLog[14].val_loss - mockTrainLog[14].train_loss).toFixed(3)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Train-Val loss divergence</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/50">
            <p className="text-sm font-medium text-foreground">Best Val IoU</p>
            <p className="text-2xl font-heading font-bold text-success mt-1">
              {Math.max(...mockTrainLog.map(d => d.val_iou)).toFixed(3)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Peak validation IoU</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/50">
            <p className="text-sm font-medium text-foreground">Plateau Epoch</p>
            <p className="text-2xl font-heading font-bold text-warning mt-1">~9</p>
            <p className="text-xs text-muted-foreground mt-1">Val loss stopped improving</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
