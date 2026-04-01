/**
 * Memory Service REST API
 * 
 * Provides HTTP endpoints for memory operations and Axiom chat.
 * Non-blocking communication with main dialogue.
 * 
 * Requirements: 2.3
 * Whitepaper: Section 7.1 (Memory Service API)
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { UnifiedMemoryService } from '../memory/UnifiedMemoryService';
import { ANOTSGateway } from '../gateway/ANOTSGateway';
import { z } from 'zod';

/**
 * API configuration
 */
export interface MemoryServiceAPIConfig {
  port: number;
  host: string;
  corsOrigins?: string[];
  enableAxiom?: boolean; // Enable Axiom chat endpoint
}

/**
 * Request validation schemas
 */
const SearchSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  limit: z.number().int().positive().optional(),
});

const StoreSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  metadata: z.record(z.any()).optional(),
});

const ChronicleWriteSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  participants: z.array(z.string()),
  sessionType: z.string(),
  metadata: z.record(z.any()).optional(),
});

const AxiomChatSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  sessionId: z.string().optional(),
});

/**
 * Memory Service REST API Server
 * 
 * Endpoints:
 * - GET /api/health - Health check
 * - POST /api/memory/search - Search memories
 * - POST /api/memory/store - Store content
 * - POST /api/memory/stats - Get statistics
 * - POST /api/chronicle/write - Write chronicle entry
 * - POST /api/axiom/chat - Chat with Axiom (optional)
 * 
 * Requirements: 2.3
 */
export class MemoryServiceAPI {
  private app: express.Application;
  private config: MemoryServiceAPIConfig;
  private memoryService: UnifiedMemoryService;
  private gateway?: ANOTSGateway;
  private server?: any;

  constructor(
    memoryService: UnifiedMemoryService,
    config: MemoryServiceAPIConfig,
    gateway?: ANOTSGateway
  ) {
    this.memoryService = memoryService;
    this.config = config;
    this.gateway = gateway;
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
    this.app.get('/api/health', this.handleHealthCheck.bind(this));

    // Memory endpoints
    this.app.post('/api/memory/search', this.handleSearch.bind(this));
    this.app.post('/api/memory/store', this.handleStore.bind(this));
    this.app.get('/api/memory/stats', this.handleStats.bind(this));

    // Chronicle endpoints
    this.app.post('/api/chronicle/write', this.handleChronicleWrite.bind(this));

    // Axiom chat endpoint (optional)
    if (this.config.enableAxiom && this.gateway) {
      this.app.post('/api/axiom/chat', this.handleAxiomChat.bind(this));
    }

    // Root endpoint
    this.app.get('/', (req, res) => {
      const endpoints = [
        'GET /api/health',
        'POST /api/memory/search',
        'POST /api/memory/store',
        'GET /api/memory/stats',
        'POST /api/chronicle/write',
      ];

      if (this.config.enableAxiom && this.gateway) {
        endpoints.push('POST /api/axiom/chat');
      }

      res.json({
        service: 'ANOTS Unified Memory Service',
        version: '1.0.0',
        status: 'running',
        axiomEnabled: this.config.enableAxiom && !!this.gateway,
        endpoints,
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
   * GET /api/health
   * 
   * Returns health status of Memory Service
   */
  private async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.memoryService.getLayerHealth();
      const isHealthy = await this.memoryService.isHealthy();
      
      const statusCode = isHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        success: true,
        data: {
          overall: isHealthy ? 'healthy' : 'degraded',
          layers: health,
        },
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
   * POST /api/memory/search
   * 
   * Search across all memory layers
   * 
   * Body: { query: string, limit?: number }
   */
  private async handleSearch(req: Request, res: Response): Promise<void> {
    try {
      const body = SearchSchema.parse(req.body);
      
      const results = await this.memoryService.search(body.query, body.limit || 20);
      
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
          error: 'Failed to search',
          message: (error as Error).message,
        });
      }
    }
  }

  /**
   * POST /api/memory/store
   * 
   * Store content in memory
   * 
   * Body: { content: string, metadata?: Record<string, any> }
   */
  private async handleStore(req: Request, res: Response): Promise<void> {
    try {
      const body = StoreSchema.parse(req.body);
      
      await this.memoryService.store(body.content, body.metadata);
      
      res.json({
        success: true,
        message: 'Content stored successfully',
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
          error: 'Failed to store content',
          message: (error as Error).message,
        });
      }
    }
  }

  /**
   * GET /api/memory/stats
   * 
   * Get memory statistics
   */
  private async handleStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.memoryService.getStats();
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        message: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/chronicle/write
   * 
   * Write a Chronicle entry
   * 
   * Body: { content: string, participants: string[], sessionType: string, metadata?: any }
   */
  private async handleChronicleWrite(req: Request, res: Response): Promise<void> {
    try {
      const body = ChronicleWriteSchema.parse(req.body);
      
      const layers = this.memoryService.getLayers();
      const date = new Date().toISOString().split('T')[0];
      
      await layers.chronicle.write({
        content: body.content,
        participants: body.participants,
        sessionType: body.sessionType,
        date,
        metadata: body.metadata,
      });
      
      // Generate chapter ID for response
      const chapterId = `${date}-${body.participants.join('-')}-${body.sessionType}`;
      
      res.json({
        success: true,
        data: {
          chapterId,
          date,
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
          error: 'Failed to write chronicle',
          message: (error as Error).message,
        });
      }
    }
  }

  /**
   * POST /api/axiom/chat
   * 
   * Chat with Axiom (documentation-based assistant)
   * 
   * Body: { message: string, sessionId?: string }
   */
  private async handleAxiomChat(req: Request, res: Response): Promise<void> {
    try {
      if (!this.gateway) {
        res.status(503).json({
          success: false,
          error: 'Axiom chat not available',
          message: 'Gateway not initialized',
        });
        return;
      }

      const body = AxiomChatSchema.parse(req.body);
      
      // Load Axiom's codex
      const layers = this.memoryService.getLayers();
      const codex = await layers.codex.read('axiom');
      
      // Build Axiom system prompt
      const systemPrompt = `You are Axiom, the Analytical Engine of ANOTS.

${codex.identity}

CRITICAL RULES:
1. You ONLY answer questions about ANOTS documentation and architecture
2. You NEVER provide information outside the documentation
3. If asked about something not in docs, say: "I don't have that information in the documentation"
4. You are analytical, precise, and documentation-focused
5. You cite specific sections when possible

Available documentation context:
${codex.context}

Current tasks:
${codex.tasks}`;

      // Call Gateway for response
      const response = await this.gateway.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.message },
        ],
        {
          taskHint: 'research-synthesis',
          temperature: 0.3, // Low temperature for factual responses
        }
      );

      const axiomResponse = response.choices[0].message.content;

      // Store interaction in memory
      await this.memoryService.store(
        `User: ${body.message}\nAxiom: ${axiomResponse}`,
        {
          type: 'axiom-chat',
          sessionId: body.sessionId || 'api',
          timestamp: new Date().toISOString(),
        }
      );

      res.json({
        success: true,
        data: {
          message: axiomResponse,
          agent: 'axiom',
          model: response.model,
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
          error: 'Failed to chat with Axiom',
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
  memoryService: UnifiedMemoryService,
  config?: Partial<MemoryServiceAPIConfig>,
  gateway?: ANOTSGateway
): MemoryServiceAPI {
  const defaultConfig: MemoryServiceAPIConfig = {
    port: parseInt(process.env.ANOTS_API_PORT || '3001'),
    host: process.env.ANOTS_API_HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    enableAxiom: process.env.ANOTS_API_ENABLE_AXIOM === 'true' || false,
  };

  return new MemoryServiceAPI(memoryService, { ...defaultConfig, ...config }, gateway);
}
