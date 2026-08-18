import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerService } from '../../services/playerService';
import { ApiError } from '../../services/apiService';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { MatchRecord } from '../../types';
import styles from './HistoryPage.module.css';

export function HistoryPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await playerService.getHistory(30);
      setMatches(response.data.matches);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 503) setError('Serviço indisponível. Tente novamente em instantes.');
        else if (err.status === 0) setError('Erro de conexão. Verifique sua internet.');
        else setError('Ocorreu um erro ao carregar o histórico.');
      } else {
        setError('Ocorreu um erro inesperado.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const formatDuration = (seconds: number): string => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return min > 0 ? `${min}min ${sec}s` : `${sec}s`;
  };

  const formatDate = (dateStr: string): string => {
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
          <h1 className={styles.title}>📜 Histórico de Partidas</h1>
          <p className={styles.subtitle}>Suas partidas mais recentes (dados do banco permanente)</p>
        </header>

        <ErrorMessage message={error} />

        {matches.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🦕</span>
            <p>Nenhuma partida registrada ainda.</p>
            <p className={styles.emptyHint}>Jogue para começar a construir seu histórico!</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pontuação</th>
                  <th>Duração</th>
                  <th>Data</th>
                  <th>Recorde?</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match, index) => (
                  <tr
                    key={match.match_id}
                    className={match.is_new_record ? styles.recordRow : ''}
                  >
                    <td className={styles.indexCell}>{index + 1}</td>
                    <td className={styles.scoreCell}>
                      {match.score.toLocaleString('pt-BR')}
                    </td>
                    <td className={styles.durationCell}>
                      {formatDuration(match.duration_seconds)}
                    </td>
                    <td className={styles.dateCell}>
                      {formatDate(match.finished_at)}
                    </td>
                    <td className={styles.recordCell}>
                      {match.is_new_record ? '🏆' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            className={styles.statsButton}
            onClick={() => navigate('/stats')}
          >
            📊 Estatísticas
          </button>
        </nav>
      </div>
    </div>
  );
}
