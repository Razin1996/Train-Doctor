export const mockTestMetrics = {
  num_test_images: 28, mean_iou: 0.612, mean_dice: 0.734,
  background_iou_mean: 0.82, water_iou_mean: 0.68, sky_iou_mean: 0.79, snow_iou_mean: 0.34
};
export const mockClassBalance = [
  { class_id: 0, class_name: "background", pixel_count: 100000, pixel_fraction: 0.62, images_present: 28, image_fraction: 1.0 },
  { class_id: 1, class_name: "water", pixel_count: 25000, pixel_fraction: 0.15, images_present: 24, image_fraction: 0.86 },
  { class_id: 2, class_name: "sky", pixel_count: 28000, pixel_fraction: 0.17, images_present: 25, image_fraction: 0.89 },
  { class_id: 3, class_name: "snow", pixel_count: 9000, pixel_fraction: 0.06, images_present: 9, image_fraction: 0.32 }
];
export const mockFindings = [
  { type: "Training Diagnosis", issue: "Overfitting", evidence: "Large train-validation gap with early best val epoch.", confidence: "High" },
  { type: "Class Performance", issue: "Weak snow segmentation", evidence: "Snow IoU is much lower than other classes.", confidence: "High" },
  { type: "Training Diagnosis", issue: "Validation plateau", evidence: "Validation IoU flattened after epoch 9.", confidence: "Medium" },
  { type: "Possible Label Noise", issue: "Possible label noise or highly difficult sample", evidence: "A few images have extremely low precision and recall.", confidence: "Medium" },
  { type: "Class Balance", issue: "Class imbalance: snow", evidence: "Snow appears in relatively few images.", confidence: "Low" }
];
export const mockTrainLog = Array.from({ length: 15 }).map((_, i) => ({
  epoch: i + 1, train_loss: 1.1 - i * 0.05, val_loss: 1.15 - i * 0.03 + (i > 8 ? (i - 8) * 0.02 : 0),
  train_iou: 0.22 + i * 0.04, val_iou: 0.20 + i * 0.032 - (i > 8 ? (i - 8) * 0.004 : 0),
  train_dice: 0.35 + i * 0.035, val_dice: 0.33 + i * 0.03 - (i > 8 ? (i - 8) * 0.003 : 0)
}));
export const mockFailureGroups = [
  { failure_type: "Severe Under-Segmentation", count: 8, avg_iou: 0.19 },
  { failure_type: "Class Confusion", count: 7, avg_iou: 0.28 },
  { failure_type: "Boundary Bleed", count: 5, avg_iou: 0.42 },
  { failure_type: "Label Noise Suspected", count: 4, avg_iou: 0.17 },
  { failure_type: "Minor Issues", count: 6, avg_iou: 0.58 }
];
export const mockPerImageMetrics = Array.from({ length: 20 }).map((_, i) => ({
  image_name: `image_${String(i + 1).padStart(3, "0")}.jpg`,
  mean_iou: [0.14,0.18,0.21,0.24,0.27,0.31,0.35,0.39,0.42,0.45,0.48,0.51,0.54,0.57,0.60,0.63,0.66,0.69,0.72,0.75][i],
  mean_dice: [0.22,0.26,0.30,0.34,0.38,0.42,0.46,0.50,0.54,0.58,0.60,0.63,0.66,0.69,0.72,0.75,0.78,0.80,0.82,0.84][i],
  failure_type: ["Severe Under-Segmentation","Label Noise Suspected","Class Confusion","Class Confusion","Boundary Bleed","Minor Issues","Minor Issues","Minor Issues","Boundary Bleed","Class Confusion","Minor Issues","Minor Issues","Minor Issues","Minor Issues","Minor Issues","Minor Issues","Minor Issues","Minor Issues","Minor Issues","Minor Issues"][i]
}));
export const mockRecommendations = [
  { priority: 1, recommendation: "Review masks for snow and inspect suspicious samples before the next run." },
  { priority: 2, recommendation: "Lower learning rate and use best validation checkpoint instead of final epoch." },
  { priority: 3, recommendation: "Increase representation of difficult conditions and minority class examples." }
];
export const mockSuggestedConfig = {
  model_name: "segformer", image_size: 512, batch_size: 4, epochs: 20, learning_rate: 0.00005,
  class_weights: { background: 1.0, water: 1.0, sky: 1.0, snow: 2.5 }
};
export const mockConfigNotes = [
  "Lowered learning rate due to validation plateau.",
  "Raised snow class weight due to weak class performance.",
  "Recommended longer training after reviewing minority class examples."
];