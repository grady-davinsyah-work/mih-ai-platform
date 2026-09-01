import { Router } from "express";
import PptxGenJS from "pptxgenjs";
import { requireLogin } from "../middleware/sessionAuth";

const router = Router();

interface SlidePlan {
  heading: string | null;
  bullets: string[];
}

// Ubah markdown sederhana menjadi rencana slide: '#' -> judul slide baru,
// '- '/angka -> bullet, baris teks -> bullet (satu slide per bagian).
export function markdownToSlides(title: string, content: string): SlidePlan[] {
  const slides: SlidePlan[] = [];
  let current: SlidePlan = { heading: null, bullets: [] };

  const pushSlide = () => {
    if (current.heading || current.bullets.length) slides.push(current);
    current = { heading: null, bullets: [] };
  };

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,4}\s+/.test(line)) {
      pushSlide();
      current.heading = line.replace(/^#{1,4}\s+/, "").replace(/[*_`]/g, "");
    } else if (/^[-*]\s+/.test(line)) {
      current.bullets.push(line.replace(/^[-*]\s+/, "").replace(/[*_`]/g, ""));
    } else if (/^\d+[.)]\s+/.test(line)) {
      current.bullets.push(line.replace(/^\d+[.)]\s+/, "").replace(/[*_`]/g, ""));
    } else {
      current.bullets.push(line.replace(/[*_`]/g, ""));
    }
  }
  pushSlide();

  if (slides.length === 0) slides.push({ heading: null, bullets: [content.trim()] });
  return slides;
}

export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "presentasi";
}

// Skill: ubah jawaban/teks menjadi presentasi PPTX yang bisa diunduh.
router.post("/skills/pptx", requireLogin, async (req, res) => {
  const title = String(req.body?.title ?? "Presentasi").slice(0, 120);
  const content = String(req.body?.content ?? "");
  if (!content.trim()) return res.status(400).json({ error: "content required" });

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "MIH — Playground";
  pptx.title = title;

  // Slide pembuka
  const cover = pptx.addSlide();
  cover.background = { color: "0F2557" };
  cover.addText(title, {
    x: 0.7, y: 2.1, w: 11.9, h: 1.6,
    fontSize: 34, bold: true, color: "FFFFFF", align: "center",
  });
  cover.addText("Dibuat dengan MIH Playground", {
    x: 0.7, y: 4.0, w: 11.9, h: 0.6,
    fontSize: 14, color: "C7D2FE", align: "center",
  });

  // Slide isi
  for (const plan of markdownToSlides(title, content)) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(plan.heading ?? title, {
      x: 0.6, y: 0.35, w: 12.1, h: 0.8,
      fontSize: 24, bold: true, color: "0F2557",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.6, y: 1.25, w: 12.1, h: 0,
      line: { color: "2563EB", width: 1.5 },
    });
    const items = plan.bullets.length ? plan.bullets : ["(tidak ada isi)"];
    slide.addText(
      items.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      {
        x: 0.7, y: 1.55, w: 11.9, h: 5.6,
        fontSize: 16, color: "1E293B", valign: "top",
        lineSpacing: 22, paraSpaceAfter: 8,
      }
    );
  }

  const buf = await pptx.write({ outputType: "nodebuffer" });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${slugify(title)}.pptx"`
  );
  res.send(Buffer.from(buf));
});

export default router;
