/**
 * Memory Service REST API
 * 
 * Provides HTTP endpoints for memory operations.
 * Non-blocking communication with main dialogue.
 * 
 * Requirements: 2.3
 * Whitepaper: Section 7.1 (Memory Service API)
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MemoryService } from '../memory/MemoryService';
import { z } from 'zod';

/**
 * API configuration
 */
export interface MemoryServiceAPIConfig {
  port: number;
  host: string;
  corsOrigins?: string[];
}

/**
 * Request validation schemas
 */
const ExtractTruthsSchema = z.object({
  dialogue: z.string().min(1, 'Dialogue cannot be empty'),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
});

const InscribeChronicleSchema = z.object({
  session: z.object({
    date: z.string(),
    chapterId: z.string(),
    participants: z.array(z.string()),
    sessionType: z.string(),
    dialogue: z.array(z.object({
      role: z.string(),
      content: z.string(),
      timestamp: z.string(),
    })),
    summary: z.string().optional(),
    truths: z.array(z.any()).optional(),
    insights: z.array(z.string()).optional(),
  }),
});

const SearchMemoriesSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  limit: z.number().int().positive().optional(),
  userId: z.string().optional(),
});

const SleepSchema = z.object({
  force: z.boolean().optional(),
});

/**
 * Memory Service REST API Server
 * 
 * Endpoints:
 * - POST /api/memory/extract-truths - Extract truths from dialogue
 * - POST /api/memory/inscribe-chronicle - Inscribe Chronicle chapter
 * - POST /api/memory/search - Search memories
 * - GET /api/memory/health - Health check
 * - POST /api/memory/sleep - Trigger sleeping cycle
 * 
 * Requirements: 2.3
 */
export class MemoryServiceAPI {
  private app: express.Application;
  private config: MemoryServiceAPIConfig;
  private memoryService: MemoryService;
  private server?: any;

  constructor(memoryService: MemoryService, config: MemoryServiceAPIConfig) {
    this.memoryService = memoryService;
    this.config = config;
    this.app = express();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigins || '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // JSON body parser
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[API] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/memory/health', this.handleHealthCheck.bind(this));

    // Extract truths endpoint
    this.app.post('/api/memory/extract-truths', this.handleExtractTruths.bind(this));

    // Inscribe Chronicle endpoint
    this.app.post('/api/memory/inscribe-chronicle', this.handleInscribeChronicle.bind(this));

    // Search memories endpoint
    this.app.post('/api/memory/search', this.handleSearchMemories.bind(this));

    // Sleep endpoint
    this.app.post('/api/memory/sleep', this.handleSleep.bind(this));

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'TCAM Memory Service',
        version: '1.0.0',
        status: 'running',
        endpoints: [
          'GET /api/memory/health',
          'POST /api/memory/extract-truths',
          'POST /api/memory/inscribe-chronicle',
          'POST /api/memory/search',
          'POST /api/memory/sleep',
        ],
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} not found`,
      });
    });

    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('[API] Error:', err);
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });
  }

  /**
   * GET /api/memory/health
   * 
   * Returns health status of Memory Service
   * 
   * Requirements: 13.1, 13.2, 13.6
   */
  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = this.memoryService.getHealth();
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 503 : 503;
      
      res.status(statusCode).json({
        success: true,
        data: health,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get health status',
        message: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/memory/extract-truths
   * 
   * Extract truths from dialogue text
   * 
   * Body: { dialogue: string, sessionId?: string, userId?: string }
   * 
   * Requirements: 8.1, 8.2
   */
  private async handleExtractTruths(req: Request, res: Response): Promise<void> {
    try {
      // Validate request
      const body = ExtractTruthsSchema.parse(req.body);
      
      // Extract truths (async, non-blocking)
      const truths = await this.memoryService.extractTruths(body.dialogue);
      
      res.json({
        success: true,
        data: {
          truths,
          count: truths.length,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to extract truths',
          message: (error as Error).message,
        });
      }
    }
  }

  /**
   * POST /api/memory/inscribe-chronicle
   * 
   * Inscribe a Chronicle chapter
   * 
   * Body: { session: ChronicleSession }
   * 
   * Requirements: 9.1, 9.2
   */
  private async handleInscribeChronicle(req: Request, res: Response): Promise<void> {
    try {
      // Validate request
      const body = InscribeChronicleSchema.parse(req.body);
      
      // Inscribe Chronicle (async, non-blocking)
      await this.memoryService.inscribeChronicle(body.session);
      
      res.json({
        success: true,
        message: 'Chronicle chapter inscribed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to inscribe Chronicle',
          message: (error as Error).message,
        });
      }
    }
  }

  /**
   * POST /api/memory/search
   * 
   * Search memories semantically
   * 
   * Body: { query: string, limit?: number, userId?: string }
   * 
   * Requirements: 11.1, 11.2
   */
  private async handleSearchMemories(req: Request, res: Response): Promise<void> {
    try {
      // Validate request
      const body = SearchMemoriesSchema.parse(req.body);
      
      // Search memories (async, non-blocking)
      const results = await this.memoryService.searchMemories(body.query);
      
      res.json({
        success: true,
        data: {
          results,
          count: results.length,
          query: body.query,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to search memories',
          message: (error as Error).message,
        });
      }
    }
  }

  /**
   * POST /api/memory/sleep
   * 
   * Trigger sleeping cycle (memory consolidation)
   * 
   * Body: { force?: boolean }
   * 
   * Requirements: 7.1, 7.2
   */
  private async handleSleep(req: Request, res: Response): Promise<void> {
    try {
      // Validate request
      const body = SleepSchema.parse(req.body);
      
      // TODO: Implement sleeping cycle in later tasks
      res.json({
        success: true,
        message: 'Sleeping cycle not implemented yet',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to trigger sleep',
          message: (error as Error).message,
        });
      }
    }
  }

  /**
   * Start API server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          console.log(`[API] Memory Service API listening on http://${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          console.error('[API] Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop API server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error?: Error) => {
        if (error) {
          console.error('[API] Error stopping server:', error);
          reject(error);
        } else {
          console.log('[API] Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }
}

/**
 * Create Memory Service API with default configuration
 */
export function createMemoryServiceAPI(
  memoryService: MemoryService,
  config?: Partial<MemoryServiceAPIConfig>
): MemoryServiceAPI {
  const defaultConfig: MemoryServiceAPIConfig = {
    port: parseInt(process.env.MEMORY_SERVICE_PORT || '3001'),
    host: process.env.MEMORY_SERVICE_HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  };

  return new MemoryServiceAPI(memoryService, { ...defaultConfig, ...config });
}
