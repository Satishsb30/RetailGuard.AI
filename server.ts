import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditResult } from './src/types/audit.ts';
import { SAMPLE_DATASETS } from './server/sampleDatasets.ts';
import { runRetailAudit } from './server/validator.ts';
import {
  GeminiServiceError,
  generateAuditBriefWithGemini,
} from './server/geminiService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB limit
const MAX_STORED_AUDITS = 25;

interface StoredAuditEntry {
  originalBuffer: Buffer;
  fileName: string;
  auditResult: AuditResult;
}

// Bounded in-memory vault holding exact untouched uploaded bytes keyed by auditId
const auditVault = new Map<string, StoredAuditEntry>();

function storeAudit(entry: StoredAuditEntry) {
  if (auditVault.size >= MAX_STORED_AUDITS) {
    const oldestKey = auditVault.keys().next().value;
    if (oldestKey) {
      auditVault.delete(oldestKey);
    }
  }
  auditVault.set(entry.auditResult.auditId, entry);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'RetailGuard AI' });
  });

  app.get('/api/samples', (_req, res) => {
    const samples = Object.values(SAMPLE_DATASETS).map((entry) => entry.info);
    res.json({ samples });
  });

  app.post('/api/analyze', upload.single('file'), (req, res) => {
    try {
      let buffer: Buffer;
      let fileName: string;

      if (req.file) {
        const lowerName = req.file.originalname.toLowerCase();
        if (
          !lowerName.endsWith('.csv') &&
          !req.file.mimetype.includes('csv') &&
          !req.file.mimetype.includes('text/plain')
        ) {
          res.status(400).json({
            error: 'Invalid file type. Please upload a .csv retail transaction file.',
          });
          return;
        }
        buffer = Buffer.from(req.file.buffer);
        fileName = path.basename(req.file.originalname) || 'uploaded_transactions.csv';
      } else if (req.body && typeof req.body.sampleId === 'string') {
        const sample = SAMPLE_DATASETS[req.body.sampleId];
        if (!sample) {
          res.status(404).json({ error: 'Requested sample dataset was not found.' });
          return;
        }
        buffer = Buffer.from(sample.csvContent, 'utf8');
        fileName = sample.info.fileName;
      } else {
        res.status(400).json({
          error: 'No CSV file or sample dataset identifier was provided.',
        });
        return;
      }

      const auditResult = runRetailAudit(buffer, fileName);
      storeAudit({
        originalBuffer: buffer,
        fileName,
        auditResult,
      });

      res.json(auditResult);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to analyze CSV file.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/explain', async (req, res) => {
    try {
      const { auditId, auditResult: clientAudit } = req.body as {
        auditId?: string;
        auditResult?: AuditResult;
      };

      let targetAudit: AuditResult | undefined;
      if (auditId && auditVault.has(auditId)) {
        targetAudit = auditVault.get(auditId)?.auditResult;
      } else if (clientAudit && Array.isArray(clientAudit.findings)) {
        targetAudit = clientAudit;
      }

      if (!targetAudit) {
        res.status(400).json({
          error: 'Missing or expired audit session. Please re-upload or select a dataset.',
        });
        return;
      }

      const brief = await generateAuditBriefWithGemini(targetAudit);
      res.json(brief);
    } catch (error) {
      if (error instanceof GeminiServiceError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate plain-language explanations with Gemini.';
      res.status(500).json({ error: message });
    }
  });

  // Streams exact untouched original CSV bytes
  app.get('/api/original/:auditId', (req, res) => {
    const entry = auditVault.get(req.params.auditId);
    if (!entry) {
      res.status(404).json({
        error: 'Original file session not found or expired. Re-upload the CSV to download.',
      });
      return;
    }

    const safeFileName = entry.fileName.replace(/[^\w.\-]/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ORIGINAL_${safeFileName}"`
    );
    res.setHeader('X-Original-SHA256', entry.auditResult.sha256);
    res.send(entry.originalBuffer);
  });

  // Error handler for Multer file size errors
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: 'CSV file exceeds the 5 MB upload limit.',
        });
        return;
      }
      next(err);
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RetailGuard AI server listening on http://localhost:${PORT}`);
  });
}

startServer();
