import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerService } from '../../services/playerService';
import { ApiError } from '../../services/apiService';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { PlayerStatsData, DbHealthData } from '../../types';
import styles from './StatsPage.module.css';

export function StatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlayerStatsData | null>(null);
  const [dbHealth, setDbHealth] = useState<DbHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [statsResponse, healthResponse] = await Promise.all([
        playerService.getStats(),
        playerService.getDbHealth(),
      ]);
      setStats(statsResponse.data);
      setDbHealth(healthResponse.data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 503) setError('Serviço indisponível. Tente novamente em instantes.');
        else if (err.status === 0) setError('Erro de conexão. Verifique sua internet.');
        else setError('Ocorreu um erro ao carregar as estatísticas.');
      } else {
        setError('Ocorreu um erro inesperado.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatPlayTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  const formatLastPlayed = (dateStr: string | null): string => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>📊 Estatísticas</h1>
          <p className={styles.subtitle}>Seus dados permanentes do banco de dados</p>
        </header>

        <ErrorMessage message={error} />

        {stats && (
          <>
            <section className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statIcon}>🏆</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>
                    {stats.best_score.toLocaleString('pt-BR')}
                  </span>
                  <span className={styles.statLabel}>Melhor Pontuação</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statIcon}>🎮</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{stats.total_games}</span>
                  <span className={styles.statLabel}>Total de Partidas</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statIcon}>📈</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>
                    {stats.average_score.toLocaleString('pt-BR')}
                  </span>
                  <span className={styles.statLabel}>Pontuação Média</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statIcon}>⏱️</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>
                    {formatPlayTime(stats.total_play_time_seconds)}
                  </span>
                  <span className={styles.statLabel}>Tempo Total de Jogo</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statIcon}>✅</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{stats.total_wins}</span>
                  <span className={styles.statLabel}>Vitórias</span>
                </div>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statIcon}>❌</span>
                <div className={styles.statInfo}>
                  <span className={styles.statValue}>{stats.total_losses}</span>
                  <span className={styles.statLabel}>Derrotas</span>
                </div>
              </div>
            </section>

            <div className={styles.lastPlayed}>
              <span className={styles.lastPlayedLabel}>Última partida:</span>
              <span className={styles.lastPlayedValue}>
                {formatLastPlayed(stats.last_played_at)}
              </span>
            </div>
          </>
        )}

        {/* Status dos serviços */}
        {dbHealth && (
          <section className={styles.healthSection}>
            <h2 className={styles.healthTitle}>🔗 Status dos Serviços</h2>
            <div className={styles.healthGrid}>
              <div className={styles.healthItem}>
                <span
                  className={`${styles.healthDot} ${
                    dbHealth.services.rds_primary === 'connected'
                      ? styles.healthDotOk
                      : styles.healthDotError
                  }`}
                />
                <span className={styles.healthName}>RDS Principal</span>
                <span className={styles.healthStatus}>
                  {dbHealth.services.rds_primary === 'connected' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <div className={styles.healthItem}>
                <span
                  className={`${styles.healthDot} ${
                    dbHealth.services.rds_replica === 'connected'
                      ? styles.healthDotOk
                      : styles.healthDotError
                  }`}
                />
                <span className={styles.healthName}>RDS Réplica</span>
                <span className={styles.healthStatus}>
                  {dbHealth.services.rds_replica === 'connected' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <div className={styles.healthItem}>
                <span
                  className={`${styles.healthDot} ${
                    dbHealth.services.elasticache === 'connected'
                      ? styles.healthDotOk
                      : styles.healthDotError
                  }`}
                />
                <span className={styles.healthName}>ElastiCache</span>
                <span className={styles.healthStatus}>
                  {dbHealth.services.elasticache === 'connected' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>
          </section>
        )}

        <div className={styles.sourceInfo}>
          <span className={styles.sourceLabel}>Fonte:</span>
          <span className={styles.sourceValue}>Réplica de leitura RDS</span>
        </div>

        <nav className={styles.actions}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate('/dashboard')}
          >
            ← Voltar
          </button>
          <button
            type="button"
            className={styles.historyButton}
            onClick={() => navigate('/history')}
          >
            📜 Histórico
          </button>
          <button
            type="button"
            className={styles.rankingButton}
            onClick={() => navigate('/ranking')}
          >
            🏅 Ranking
          </button>
        </nav>
      </div>
    </div>
  );
}
