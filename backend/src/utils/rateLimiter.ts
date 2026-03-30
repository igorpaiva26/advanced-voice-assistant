/**
 * Rate Limiter para Gemini API
 * Garante que não ultrapassamos o free tier (15 req/min)
 */

const MAX_REQUESTS_PER_MINUTE = 14; // Margem de segurança
const MAX_REQUESTS_PER_DAY = 1400; // Limite diário (bem abaixo de 1500)
const WINDOW_MS = 60000; // 1 minuto
const DAY_MS = 86400000; // 24 horas

class RateLimiter {
  private requests: number[] = [];
  private dailyRequests: number[] = [];
  private totalRequests = 0;
  private blocked = false;

  async waitIfNeeded(): Promise<void> {
    // KILL SWITCH: Se bloqueado, não permite mais requisições
    if (this.blocked) {
      throw new Error('❌ RATE LIMITER BLOQUEADO: Limite diário atingido. Aguarde 24h ou reinicie o servidor.');
    }

    const now = Date.now();
    
    // Remove requisições antigas (fora da janela de 1 minuto)
    this.requests = this.requests.filter(time => now - time < WINDOW_MS);
    
    // Remove requisições antigas (fora da janela de 24h)
    this.dailyRequests = this.dailyRequests.filter(time => now - time < DAY_MS);
    
    // KILL SWITCH: Bloqueia se atingir limite diário
    if (this.dailyRequests.length >= MAX_REQUESTS_PER_DAY) {
      this.blocked = true;
      console.error(`\n🚨🚨🚨 RATE LIMITER BLOQUEADO 🚨🚨🚨`);
      console.error(`Limite diário atingido: ${this.dailyRequests.length}/${MAX_REQUESTS_PER_DAY}`);
      console.error(`Servidor bloqueado para evitar cobranças.`);
      console.error(`Reinicie o servidor amanhã ou aumente o limite.\n`);
      throw new Error('❌ Limite diário de requisições atingido!');
    }
    
    // Alerta se estiver perto do limite diário
    if (this.dailyRequests.length >= MAX_REQUESTS_PER_DAY * 0.9) {
      console.error(`\n🚨 ALERTA CRÍTICO: ${this.dailyRequests.length}/${MAX_REQUESTS_PER_DAY} requisições hoje (90%)\n`);
    } else if (this.dailyRequests.length >= MAX_REQUESTS_PER_DAY * 0.7) {
      console.warn(`\n⚠️  ALERTA: ${this.dailyRequests.length}/${MAX_REQUESTS_PER_DAY} requisições hoje (70%)\n`);
    }
    
    // Se estamos no limite por minuto, aguarda o tempo necessário
    if (this.requests.length >= MAX_REQUESTS_PER_MINUTE) {
      const oldestRequest = this.requests[0];
      const waitTime = WINDOW_MS - (now - oldestRequest) + 100; // +100ms de margem
      
      console.log(`[rate-limiter] ⏳ Aguardando ${Math.ceil(waitTime / 1000)}s para respeitar limite (${this.requests.length}/${MAX_REQUESTS_PER_MINUTE} req/min)`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Limpa requisições antigas após esperar
      const newNow = Date.now();
      this.requests = this.requests.filter(time => newNow - time < WINDOW_MS);
    }
    
    // Registra nova requisição
    this.requests.push(Date.now());
    this.dailyRequests.push(Date.now());
    this.totalRequests++;
    
    // Log informativo
    const percentage = Math.round((this.requests.length / MAX_REQUESTS_PER_MINUTE) * 100);
    const dailyPercentage = Math.round((this.dailyRequests.length / MAX_REQUESTS_PER_DAY) * 100);
    console.log(`[rate-limiter] 📊 Req #${this.totalRequests} | Min: ${this.requests.length}/${MAX_REQUESTS_PER_MINUTE} (${percentage}%) | Dia: ${this.dailyRequests.length}/${MAX_REQUESTS_PER_DAY} (${dailyPercentage}%)`);
    
    // Alerta se estiver perto do limite por minuto
    if (this.requests.length >= MAX_REQUESTS_PER_MINUTE * 0.8) {
      console.warn(`[rate-limiter] ⚠️  Atenção: ${this.requests.length}/${MAX_REQUESTS_PER_MINUTE} requisições no último minuto!`);
    }
  }

  getStats() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < WINDOW_MS);
    this.dailyRequests = this.dailyRequests.filter(time => now - time < DAY_MS);
    
    return {
      currentMinute: this.requests.length,
      maxPerMinute: MAX_REQUESTS_PER_MINUTE,
      currentDay: this.dailyRequests.length,
      maxPerDay: MAX_REQUESTS_PER_DAY,
      total: this.totalRequests,
      percentageMinute: Math.round((this.requests.length / MAX_REQUESTS_PER_MINUTE) * 100),
      percentageDay: Math.round((this.dailyRequests.length / MAX_REQUESTS_PER_DAY) * 100),
      blocked: this.blocked
    };
  }
}

export const geminiRateLimiter = new RateLimiter();
