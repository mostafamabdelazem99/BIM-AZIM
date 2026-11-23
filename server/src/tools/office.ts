import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import ExcelJS from "exceljs";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from "docx";
import PptxGenJSImport from "pptxgenjs";

// pptxgenjs's bundled .d.ts doesn't resolve as a constructable default export under
// NodeNext/ESM module resolution, even though the real CJS export is a plain class — cast once
// here rather than littering @ts-expect-error through the rest of the file.
const PptxGenJS = PptxGenJSImport as unknown as new () => InstanceType<typeof PptxGenJSCtor>;
declare class PptxGenJSCtor {
  author: string;
  title: string;
  addSlide(): {
    background: { color: string };
    addText: (text: unknown, options: Record<string, unknown>) => void;
    addNotes: (notes: string) => void;
  };
  writeFile(opts: { fileName: string }): Promise<string>;
}
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toToolResponse } from "./types.js";

// Office documents are generated directly by this process (ExcelJS/docx/pptxgenjs) rather than
// through a native bridge — no Word/Excel/PowerPoint installation is required on the machine.

const BRAND_ACCENT = "0D7A73";
const BRAND_ACCENT_BRIGHT = "2DD4C4";
const BRAND_SECONDARY = "E3792B";
const BRAND_DARK = "11151C";

function defaultExportDir(): string {
  return path.join(os.homedir(), "Documents", "BIM-AZIM Exports");
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 120) || "BIM-AZIM-Export";
}

function resolveOutputPath(outputPath: string | undefined, fallbackFileName: string): string {
  const resolved = outputPath && outputPath.trim().length > 0
    ? outputPath
    : path.join(defaultExportDir(), fallbackFileName);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function buildDocxTable(table: { headers: string[]; rows: string[][] }): Table {
  const headerRow = new TableRow({
    children: table.headers.map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ text: h, heading: HeadingLevel.HEADING_6 })],
          shading: { fill: BRAND_ACCENT },
        }),
    ),
  });
  const bodyRows = table.rows.map(
    (row) =>
      new TableRow({
        children: row.map((cell) => new TableCell({ children: [new Paragraph(String(cell))] })),
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

const sectionShape = z.object({
  heading: z.string().describe("Section heading text."),
  body: z.string().optional().describe("Plain paragraph text for this section."),
  table: z
    .object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .optional()
    .describe("Optional table rendered under the section body (e.g. a schedule or clash list)."),
});

const sheetShape = z.object({
  name: z.string().describe("Worksheet tab name (Excel caps this at 31 characters)."),
  columns: z.array(z.string()).describe("Header row."),
  rows: z
    .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
    .describe("Data rows, each the same length as columns."),
});

const slideShape = z.object({
  title: z.string(),
  bullets: z.array(z.string()).optional(),
  notes: z.string().optional().describe("Speaker notes, not shown on the slide itself."),
});

export function registerOfficeTools(server: McpServer) {
  server.tool(
    "office_create_word_report",
    "Generate a real Microsoft Word (.docx) report from structured data — e.g. a clash report, audit summary, or handover document. No Microsoft Word installation required.",
    {
      title: z.string().describe("Document title, also used as the default file name."),
      outputPath: z.string().optional().describe("Absolute .docx path. Defaults to Documents/BIM-AZIM Exports/<title>.docx"),
      sections: z.array(sectionShape).min(1),
    },
    async (args) => {
      try {
        const fileName = `${sanitizeFileName(args.title)}.docx`;
        const outPath = resolveOutputPath(args.outputPath, fileName);

        const children: (Paragraph | Table)[] = [
          new Paragraph({ text: args.title, heading: HeadingLevel.TITLE }),
        ];
        for (const section of args.sections) {
          children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }));
          if (section.body) children.push(new Paragraph({ text: section.body }));
          if (section.table) children.push(buildDocxTable(section.table));
        }

        const doc = new Document({ sections: [{ children }] });
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(outPath, buffer);

        return toToolResponse({ ok: true, data: { path: outPath, sectionCount: args.sections.length } });
      } catch (err) {
        return toToolResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.tool(
    "office_create_excel_workbook",
    "Generate a real Microsoft Excel (.xlsx) workbook from structured data — e.g. a schedule, parameter export, or clash list, with multiple sheets. No Microsoft Excel installation required.",
    {
      fileName: z.string().optional().describe("Used only when outputPath is omitted. Defaults to BIM-AZIM-Export.xlsx"),
      outputPath: z.string().optional().describe("Absolute .xlsx path. Defaults to Documents/BIM-AZIM Exports/<fileName>"),
      sheets: z.array(sheetShape).min(1),
    },
    async (args) => {
      try {
        const fileName = args.fileName ? sanitizeFileName(args.fileName) + ".xlsx" : "BIM-AZIM-Export.xlsx";
        const outPath = resolveOutputPath(args.outputPath, fileName);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "BIM-AZIM";
        workbook.created = new Date();

        for (const sheet of args.sheets) {
          const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31));
          worksheet.addRow(sheet.columns);
          const headerRow = worksheet.getRow(1);
          headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
          headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_ACCENT}` } };
          worksheet.views = [{ state: "frozen", ySplit: 1 }];
          for (const row of sheet.rows) worksheet.addRow(row);
          worksheet.columns.forEach((col) => {
            col.width = 20;
          });
        }

        await workbook.xlsx.writeFile(outPath);

        return toToolResponse({
          ok: true,
          data: { path: outPath, sheets: args.sheets.map((s) => ({ name: s.name, rowCount: s.rows.length })) },
        });
      } catch (err) {
        return toToolResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.tool(
    "office_read_excel_workbook",
    "Read an existing Microsoft Excel (.xlsx) file and return its sheets as JSON rows — e.g. to import a schedule or parameter sheet back into a BIM-AZIM workflow.",
    {
      filePath: z.string().describe("Absolute path to an existing .xlsx file."),
      sheetName: z.string().optional().describe("Read only this sheet; defaults to all sheets."),
    },
    async (args) => {
      try {
        if (!fs.existsSync(args.filePath)) {
          return toToolResponse({ ok: false, error: `File not found: ${args.filePath}` });
        }
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(args.filePath);
        const worksheets = args.sheetName
          ? [workbook.getWorksheet(args.sheetName)].filter((ws): ws is ExcelJS.Worksheet => ws !== undefined)
          : workbook.worksheets;

        if (args.sheetName && worksheets.length === 0) {
          return toToolResponse({ ok: false, error: `Sheet not found: ${args.sheetName}` });
        }

        const sheets = worksheets.map((ws) => {
          const rows: unknown[][] = [];
          ws.eachRow((row) => {
            rows.push((row.values as unknown[]).slice(1));
          });
          return { name: ws.name, rows };
        });

        return toToolResponse({ ok: true, data: { sheets } });
      } catch (err) {
        return toToolResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.tool(
    "office_create_powerpoint",
    "Generate a real Microsoft PowerPoint (.pptx) deck from structured data — e.g. a model-review or clash-walkthrough deck, branded with BIM-AZIM colors. No PowerPoint installation required.",
    {
      title: z.string(),
      subtitle: z.string().optional(),
      outputPath: z.string().optional().describe("Absolute .pptx path. Defaults to Documents/BIM-AZIM Exports/<title>.pptx"),
      slides: z.array(slideShape).min(1),
    },
    async (args) => {
      try {
        const fileName = `${sanitizeFileName(args.title)}.pptx`;
        const outPath = resolveOutputPath(args.outputPath, fileName);

        const pres = new PptxGenJS();
        pres.author = "BIM-AZIM";
        pres.title = args.title;

        const titleSlide = pres.addSlide();
        titleSlide.background = { color: BRAND_DARK };
        titleSlide.addText(args.title, {
          x: 0.6, y: 2.1, w: 8.8, h: 1.2, fontSize: 36, bold: true, color: BRAND_ACCENT_BRIGHT,
        });
        if (args.subtitle) {
          titleSlide.addText(args.subtitle, {
            x: 0.6, y: 3.2, w: 8.8, h: 0.6, fontSize: 18, color: BRAND_SECONDARY,
          });
        }

        for (const slide of args.slides) {
          const s = pres.addSlide();
          s.background = { color: "FFFFFF" };
          s.addText(slide.title, {
            x: 0.5, y: 0.35, w: 9, h: 0.8, fontSize: 26, bold: true, color: BRAND_ACCENT,
          });
          if (slide.bullets && slide.bullets.length > 0) {
            s.addText(
              slide.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
              { x: 0.6, y: 1.35, w: 8.8, h: 5, fontSize: 16, color: BRAND_DARK },
            );
          }
          if (slide.notes) s.addNotes(slide.notes);
        }

        await pres.writeFile({ fileName: outPath });

        return toToolResponse({ ok: true, data: { path: outPath, slideCount: args.slides.length + 1 } });
      } catch (err) {
        return toToolResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    },
  );
}
