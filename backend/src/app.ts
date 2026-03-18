import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import allocateRouter from './routes/allocate.route';
import searchRouter from './routes/search.route';
import shelvesRouter from './routes/shelves.route';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/allocate', allocateRouter);
app.use('/api/search', searchRouter);
app.use('/api/shelves', shelvesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message ?? 'Internal server error' });
});

export default app;
