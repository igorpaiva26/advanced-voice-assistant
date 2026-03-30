import { Router, Request, Response } from 'express';
import { geminiRateLimiter } from '../utils/rateLimiter';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const stats = geminiRateLimiter.getStats();
  res.json({
    message: 'Estatísticas de uso da API Gemini',
    stats: {
      ultimo_minuto: {
        requisicoes: stats.currentMinute,
        limite: stats.maxPerMinute,
        uso: `${stats.percentageMinute}%`,
        status: stats.percentageMinute >= 80 ? '⚠️ ALTO' : stats.percentageMinute >= 50 ? '⚡ MODERADO' : '✅ NORMAL'
      },
      hoje: {
        requisicoes: stats.currentDay,
        limite: stats.maxPerDay,
        uso: `${stats.percentageDay}%`,
        status: stats.percentageDay >= 90 ? '🚨 CRÍTICO' : stats.percentageDay >= 70 ? '⚠️ ALTO' : stats.percentageDay >= 50 ? '⚡ MODERADO' : '✅ NORMAL'
      },
      total_desde_inicio: stats.total,
      bloqueado: stats.blocked ? '🚨 SIM - Limite diário atingido!' : '✅ NÃO'
    }
  });
});

export default router;
