import express from 'express';
import { createServer as createViteServer, loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const mode = process.env.NODE_ENV || 'development';
  const env = loadEnv(mode, process.cwd(), '');
  
  // Inject loaded env into process.env if they are not already there
  Object.assign(process.env, env);
  
  console.log('[Server Init] Loaded Env Vars:', Object.keys(env).filter(k => !k.includes('SECRET') && !k.includes('KEY')));
  console.log('[Server Init] Important Vars Present:', {
    hasUrl: !!process.env.VITE_SUPABASE_URL,
    hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const app = express();
  
  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(express.json());

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, 'public')));

  // Helper to handle API routes similarly to Vercel
  app.all('/api/*', async (req, res, next) => {
    // Skip if it's Vite's internal stuff
    if (req.path.includes('/@vite/') || req.path.includes('/node_modules/')) {
      return next();
    }

    console.log(`[API Request] ${req.method} ${req.path}`);

    try {
      const apiPath = req.path.replace(/^\/api\//, '');
      const segments = apiPath.split('/');
      
      // Try to find the file in /api directory
      let filePath = '';
      let possiblePaths = [
        path.join(__dirname, 'api', apiPath + '.ts'),
        path.join(__dirname, 'api', apiPath, 'index.ts'),
      ];

      // Handle dynamic routes like [id].ts
      if (segments.length >= 2) {
        const lastSegment = segments[segments.length - 1];
        const secondToLast = segments.slice(0, -1).join('/');
        possiblePaths.push(path.join(__dirname, 'api', secondToLast, '[id].ts'));
      }

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          filePath = p;
          break;
        }
      }

      if (filePath) {
        console.log(`[API] Serving from ${filePath}`);
        
        // Debug env presence
        console.log('[API Env Check]', {
          hasUrl: !!process.env.VITE_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        });

        const module = await vite.ssrLoadModule(filePath);
        if (module.default) {
          if (filePath.endsWith('[id].ts')) {
             const segments = apiPath.split('/');
             req.query.id = segments[segments.length - 1];
          }
          return await module.default(req, res);
        } else {
          console.error(`[API ERROR] No default export found in ${filePath}`);
        }
      } else {
        console.warn(`[API] No file found for ${req.path}. Checked:`, possiblePaths);
      }

      // If no API file found, let Vite handle it
      next();
    } catch (err: any) {
      console.error('Dev API Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
