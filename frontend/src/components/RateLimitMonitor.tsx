import { useEffect, useState } from 'react';
import './RateLimitMonitor.css';

interface Stats {
  ultimo_minuto: {
    requisicoes: number;
    limite: number;
    uso: string;
    status: string;
  };
  hoje: {
    requisicoes: number;
    limite: number;
    uso: string;
    status: string;
  };
  total_desde_inicio: number;
  bloqueado: string;
}

export function RateLimitMonitor() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://192.168.0.2:3002/api/stats');
        const data = await res.json();
        setStats(data.stats);
      } catch (err) {
        console.error('Erro ao buscar stats:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000); // Atualiza a cada 3s

    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const minutePercent = parseInt(stats.ultimo_minuto.uso);
  const dayPercent = parseInt(stats.hoje.uso);

  const getColor = (percent: number) => {
    if (percent >= 90) return '#ef4444'; // vermelho
    if (percent >= 70) return '#f59e0b'; // laranja
    if (percent >= 50) return '#eab308'; // amarelo
    return '#10b981'; // verde
  };

  return (
    <div className={`rate-monitor ${visible ? 'visible' : 'hidden'}`}>
      <div className="rate-monitor__header">
        <span className="rate-monitor__title">📊 API Gemini</span>
        <button 
          className="rate-monitor__toggle"
          onClick={() => setVisible(!visible)}
          title={visible ? 'Minimizar' : 'Expandir'}
        >
          {visible ? '−' : '+'}
        </button>
      </div>

      {visible && (
        <div className="rate-monitor__content">
          {/* Último minuto */}
          <div className="rate-monitor__item">
            <div className="rate-monitor__label">
              <span>Último minuto</span>
              <span className="rate-monitor__value">
                {stats.ultimo_minuto.requisicoes}/{stats.ultimo_minuto.limite}
              </span>
            </div>
            <div className="rate-monitor__bar">
              <div 
                className="rate-monitor__bar-fill"
                style={{ 
                  width: `${minutePercent}%`,
                  backgroundColor: getColor(minutePercent)
                }}
              />
            </div>
          </div>

          {/* Hoje */}
          <div className="rate-monitor__item">
            <div className="rate-monitor__label">
              <span>Hoje</span>
              <span className="rate-monitor__value">
                {stats.hoje.requisicoes}/{stats.hoje.limite}
              </span>
            </div>
            <div className="rate-monitor__bar">
              <div 
                className="rate-monitor__bar-fill"
                style={{ 
                  width: `${dayPercent}%`,
                  backgroundColor: getColor(dayPercent)
                }}
              />
            </div>
            <div className="rate-monitor__percent">{stats.hoje.uso}</div>
          </div>

          {/* Alerta se crítico */}
          {dayPercent >= 70 && (
            <div className="rate-monitor__alert">
              {dayPercent >= 90 ? '🚨 CRÍTICO!' : '⚠️ Alto uso'}
            </div>
          )}

          {/* Total */}
          <div className="rate-monitor__total">
            Total: {stats.total_desde_inicio} requisições
          </div>
        </div>
      )}
    </div>
  );
}
