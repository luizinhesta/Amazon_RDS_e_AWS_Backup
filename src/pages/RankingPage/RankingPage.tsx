import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { playerService } from '../../services/playerService';
import { ApiError } from '../../services/apiService';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { RankingEntry, PersistentRankingEntry } from '../../types';
import styles from './RankingPage.module.css';

type RankingSource = 'realtime' | 'persistent';

export function RankingPage() {
  const navigate = useNavigate();
  const [realtimeRanking, setRealtimeRanking] = useState<RankingEntry[]>([]);
  const [persistentRanking, setPersistentRanking] = useState<PersistentRankingEntry[]>([]);
  const [activeSource, setActiveSource] = useState<RankingSource>('realtime');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRankings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [realtimeResponse, persistentResponse] = await Promise.all([
        gameService.getRanking(),
        playerService.getPersistentRanking(20),
      ]);
      setRealtimeRanking(realtimeResponse.data);
      setPersistentRanking(persistentResponse.data.ranking);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 503) setError('Serviço indisponível. Tente novamente.');
        else if (err.status === 0) setError('Erro de conexão.');
        else setError('Erro ao carregar o ranking.');
      } else {
        setError('Ocorreu um erro inesperado.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

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
          <h1 className={styles.title}>🏅 Ranking</h1>
          <p className={styles.subtitle}>
            Compare o ranking em tempo real (ElastiCache) com o consolidado (RDS)
          </p>
        </header>

        <ErrorMessage message={error} />

        {/* Tab selector */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeSource === 'realtime' ? styles.tabActive : ''}`}
            onClick={() => setActiveSource('realtime')}
          >
            ⚡ Tempo Real (Cache)
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeSource === 'persistent' ? styles.tabActive : ''}`}
            onClick={() => setActiveSource('persistent')}
          >
            💾 Consolidado (RDS)
          </button>
        </div>

        {/* Realtime Ranking */}
        {activeSource === 'realtime' && (
          <div className={styles.rankingContent}>
            <p className={styles.sourceDescription}>
              Dados do ElastiCache — atualização instantânea, mas dados temporários (podem ser perdidos se o cluster reiniciar)
            </p>
            {realtimeRanking.length === 0 ? (
              <p className={styles.emptyMessage}>Nenhum jogador no ranking em tempo real</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Jogador</th>
                    <th>Pontuação</th>
                  </tr>
                </thead>
                <tbody>
                  {realtimeRanking.map((entry) => (
                    <tr key={entry.position}>
                      <td className={styles.positionCell}>
                        {entry.position <= 3 ? ['🥇', '🥈', '🥉'][entry.position - 1] : entry.position}
                      </td>
                      <td className={styles.usernameCell}>{entry.username}</td>
                      <td className={styles.scoreCell}>{entry.score.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Persistent Ranking */}
        {activeSource === 'persistent' && (
          <div className={styles.rankingContent}>
            <p className={styles.sourceDescription}>
              Dados do Amazon RDS (réplica de leitura) — dados permanentes, pode ter pequena defasagem
            </p>
            {persistentRanking.length === 0 ? (
              <p className={styles.emptyMessage}>Nenhum jogador no ranking consolidado</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Jogador</th>
                    <th>Melhor Pontuação</th>
                    <th>Partidas</th>
                  </tr>
                </thead>
                <tbody>
                  {persistentRanking.map((entry) => (
                    <tr key={entry.position}>
                      <td className={styles.positionCell}>
                        {entry.position <= 3 ? ['🥇', '🥈', '🥉'][entry.position - 1] : entry.position}
                      </td>
                      <td className={styles.usernameCell}>{entry.username}</td>
                      <td className={styles.scoreCell}>{entry.best_score.toLocaleString('pt-BR')}</td>
                      <td className={styles.gamesCell}>{entry.total_games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className={styles.comparison}>
          <h3 className={styles.comparisonTitle}>📋 Comparação Cache vs Banco</h3>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>Característica</th>
                <th>ElastiCache (Cache)</th>
                <th>RDS (Banco)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Velocidade</td>
                <td>⚡ Submilissegundo</td>
                <td>🐢 Milissegundos</td>
              </tr>
              <tr>
                <td>Persistência</td>
                <td>❌ Temporário (TTL)</td>
                <td>✅ Permanente</td>
              </tr>
              <tr>
                <td>Atualização</td>
                <td>🔄 Tempo real</td>
                <td>⏱️ Pequena defasagem</td>
              </tr>
              <tr>
                <td>Uso ideal</td>
                <td>Sessões, ranking live</td>
                <td>Histórico, relatórios</td>
              </tr>
            </tbody>
          </table>
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
            className={styles.refreshButton}
            onClick={loadRankings}
          >
            🔄 Atualizar
          </button>
        </nav>
      </div>
    </div>
  );
}
